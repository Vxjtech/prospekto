import 'server-only';
import {query} from '@/db';
import {assertChatAccess,chatAccess} from './access';
import {requireAccount} from '@/lib/accounts/store';
import type {User} from '@/lib/auth';
import {HttpError} from '@/lib/http';
import type {z} from 'zod';
import type {messengerAction,Contact,Conversation,ChatMessage,ChatPage} from './model';
const contactColumns="a.id,a.name,a.type,COALESCE(p.avatar_url,'') AS avatarUrl,COALESCE(s.city,'') AS city";
const joins=' LEFT JOIN provider_profiles p ON p.account_id=a.id LEFT JOIN service_areas s ON s.account_id=a.id ';
function participant(accountId:string,conversationId:string){
  if(!query('SELECT 1 FROM conversations WHERE id=? AND (account_low=? OR account_high=?)',conversationId,accountId,accountId).get())throw new HttpError(404,'Konverzace nebyla nalezena.');
}
// Caller must already have checked the relationship. All writes run in the API transaction.
export function ensureConversation(accountId:string,contactId:string){
  if(accountId===contactId)throw new HttpError(400,'Vyberte jiný kontakt.');
  const [low,high]=[accountId,contactId].sort(),now=new Date().toISOString();
  const current=query('SELECT id FROM conversations WHERE account_low=? AND account_high=?',low,high).get<{id:string}>();
  if(current)return current.id;
  if(query('SELECT COUNT(*) AS n FROM conversations WHERE account_low=? OR account_high=?',accountId,accountId).get<{n:number}>()!.n>=10000)throw new HttpError(409,'Dosáhli jste limitu konverzací.');
  const id=crypto.randomUUID();query('INSERT INTO conversations VALUES(?,?,?,?,?)',id,low,high,now,now).run();return id;
}
export function conversationList(user:User){
  const id=requireAccount(user).id;
  return query('SELECT '+contactColumns+",c.id AS conversationId,c.updated_at AS updatedAt,COALESCE((SELECT body FROM messages WHERE conversation_id=c.id ORDER BY created_at DESC,id DESC LIMIT 1),'Začněte konverzaci') AS lastMessage,"+
    " (SELECT COUNT(*) FROM messages m WHERE m.conversation_id=c.id AND m.sender_account_id<>? AND m.created_at>COALESCE(cr.last_read_at,'')) AS unread"+
    ' FROM conversations c JOIN accounts a ON a.id=CASE WHEN c.account_low=? THEN c.account_high ELSE c.account_low END'+joins+
    ' LEFT JOIN conversation_reads cr ON cr.conversation_id=c.id AND cr.account_id=? WHERE c.account_low=? OR c.account_high=? ORDER BY c.updated_at DESC,c.id DESC LIMIT 500',id,id,id,id,id).all<Conversation>();
}
export function contacts(user:User,search:string){
  const account=requireAccount(user),id=account.id;
  // Customers are discoverable only through an accepted offer or conversation, never a public customer directory.
  const match=search.trim().slice(0,100).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
  return query('SELECT '+contactColumns+' FROM accounts a'+joins+
    " WHERE a.id<>? AND a.completed_at IS NOT NULL AND (instr(normalize_text(a.name),?)>0 OR instr(normalize_text(s.city),?)>0) AND (p.account_id IS NOT NULL OR EXISTS(SELECT 1 FROM offers o JOIN requests r ON r.id=o.request_id WHERE o.provider_account_id=? AND o.status='ACCEPTED' AND r.customer_account_id=a.id) OR EXISTS(SELECT 1 FROM conversations c WHERE (c.account_low=? AND c.account_high=a.id) OR (c.account_high=? AND c.account_low=a.id))) AND (?<>'CUSTOMER' OR EXISTS(SELECT 1 FROM offers o JOIN requests r ON r.id=o.request_id WHERE r.customer_account_id=? AND o.provider_account_id=a.id AND o.status='ACCEPTED')) ORDER BY a.name,a.id LIMIT 50",id,match,match,id,id,id,account.type,id).all<Contact>();
}
export function messagePage(user:User,conversationId:string,before?:string):ChatPage{
  const id=requireAccount(user).id;participant(id,conversationId);
  const cursor=before?query('SELECT created_at,id FROM messages WHERE id=? AND conversation_id=?',before,conversationId).get<{created_at:string;id:string}>():undefined;
  if(before&&!cursor)throw new HttpError(400,'Neplatná stránka zpráv.');
  const rows=query('SELECT m.id,m.sender_account_id AS senderAccountId,a.name AS senderName,m.body,m.created_at AS createdAt,r.title AS requestTitle FROM messages m JOIN accounts a ON a.id=m.sender_account_id LEFT JOIN requests r ON r.id=m.request_id WHERE m.conversation_id=?'+
    (cursor?' AND (m.created_at<? OR (m.created_at=? AND m.id<?))':'')+' ORDER BY m.created_at DESC,m.id DESC LIMIT 51',conversationId,...(cursor?[cursor.created_at,cursor.created_at,cursor.id]:[])).all<ChatMessage>();
  const pair=query('SELECT account_low,account_high FROM conversations WHERE id=?',conversationId).get<{account_low:string;account_high:string}>()!;
  const access=chatAccess(id,pair.account_low===id?pair.account_high:pair.account_low);
  const more=rows.length>50,items=rows.slice(0,50).reverse();return {items,nextCursor:more?items[0].id:null,canSend:access.allowed,accepted:access.accepted};
}
export function sendMessage(user:User,conversationId:string,body:string,clientId:string,requestId:string|null=null,providerId:string|null=null){
  const account=requireAccount(user),id=account.id;participant(id,conversationId);
  const pair=query('SELECT account_low,account_high FROM conversations WHERE id=?',conversationId).get<{account_low:string;account_high:string}>()!;
  assertChatAccess(id,pair.account_low===id?pair.account_high:pair.account_low);
  const existing=query('SELECT conversation_id,sender_account_id,body FROM messages WHERE id=?',clientId).get<{conversation_id:string;sender_account_id:string;body:string}>();
  if(existing){if(existing.conversation_id!==conversationId||existing.sender_account_id!==id||existing.body!==body)throw new HttpError(409,'Zprávu nelze odeslat s tímto identifikátorem.');return;}
  if(query('SELECT COUNT(*) AS n FROM messages WHERE sender_account_id=?',id).get<{n:number}>()!.n>=10000)throw new HttpError(409,'Dosáhli jste limitu zpráv.');
  const now=new Date().toISOString();
  if(query('SELECT COUNT(*) AS n FROM messages WHERE sender_account_id=? AND created_at>?',id,new Date(Date.now()-60000).toISOString()).get<{n:number}>()!.n>=30)throw new HttpError(429,'Posíláte zprávy příliš rychle. Za chvíli to zkuste znovu.');
  query('INSERT INTO messages(id,conversation_id,request_id,provider_account_id,sender_user_id,sender_account_id,body,created_at) VALUES(?,?,?,?,?,?,?,?)',clientId,conversationId,requestId,providerId,user.userId,id,body,now).run();
  query('UPDATE conversations SET updated_at=? WHERE id=?',now,conversationId).run();
}
export function messengerWrite(user:User,input:z.infer<typeof messengerAction>){
  const id=requireAccount(user).id;
  if(input.action==='start'){
    const contact=query('SELECT a.id FROM accounts a LEFT JOIN provider_profiles p ON p.account_id=a.id WHERE a.id=? AND a.completed_at IS NOT NULL AND (p.account_id IS NOT NULL OR EXISTS(SELECT 1 FROM offers o JOIN requests r ON r.id=o.request_id WHERE o.provider_account_id=? AND o.status=\'ACCEPTED\' AND r.customer_account_id=a.id) OR EXISTS(SELECT 1 FROM conversations c WHERE (c.account_low=? AND c.account_high=a.id) OR (c.account_high=? AND c.account_low=a.id)))',input.contactId,id,id,id).get();
    if(!contact)throw new HttpError(404,'Kontakt není dostupný.');
    const access=chatAccess(id,input.contactId);
    if(!access.accepted)throw new HttpError(403,'Nejdříve musí zákazník přijmout nabídku. Přejděte do Nabídek.');
    return ensureConversation(id,input.contactId);
  }
  participant(id,input.conversationId);
  if(input.action==='send')sendMessage(user,input.conversationId,input.body,input.clientId);
  if(input.action==='read'){
    const message=query('SELECT created_at FROM messages WHERE id=? AND conversation_id=?',input.messageId,input.conversationId).get<{created_at:string}>();
    if(!message)throw new HttpError(404,'Zpráva nebyla nalezena.');
    query('INSERT INTO conversation_reads VALUES(?,?,?) ON CONFLICT(conversation_id,account_id) DO UPDATE SET last_read_at=max(last_read_at,excluded.last_read_at)',input.conversationId,id,message.created_at).run();
  }
  return input.conversationId;
}
