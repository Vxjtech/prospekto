import 'server-only';
import {query} from '@/db';
import {assertChatAccess} from './access';
import {requireAccount} from '@/lib/accounts/store';
import type {User} from '@/lib/auth';
import {HttpError} from '@/lib/http';
import type {z} from 'zod';
import type {messengerAction,Conversation,ChatMessage,ChatPage} from './model';

type Thread={requestId:string;providerId:string;customerId:string;requestTitle:string;requestPhoto:string};

function threadFor(accountId:string,conversationId:string):Thread{
  const thread=query("SELECT c.request_id AS requestId,c.provider_account_id AS providerId,r.customer_account_id AS customerId,r.title AS requestTitle,COALESCE((SELECT '/api/media/'||ri.media_id||'/' FROM request_images ri WHERE ri.request_id=r.id ORDER BY ri.position LIMIT 1),'') AS requestPhoto FROM conversations c JOIN requests r ON r.id=c.request_id WHERE c.id=? AND (c.account_low=? OR c.account_high=?)",conversationId,accountId,accountId).get<Thread>();
  if(!thread)throw new HttpError(404,'Konverzace nebyla nalezena.');
  assertChatAccess(accountId,thread.requestId,thread.providerId,thread.customerId);
  return thread;
}

export function ensureConversation(providerId:string,requestId:string){
  const request=query('SELECT customer_account_id AS customerId FROM requests WHERE id=?',requestId).get<{customerId:string}>();
  if(!request||request.customerId===providerId)throw new HttpError(404,'Zakázka nebyla nalezena.');
  assertChatAccess(providerId,requestId,providerId,request.customerId);
  const [low,high]=[providerId,request.customerId].sort(),now=new Date().toISOString();
  const current=query('SELECT id FROM conversations WHERE request_id=? AND provider_account_id=?',requestId,providerId).get<{id:string}>();
  if(current)return current.id;
  if(query('SELECT COUNT(*) AS n FROM conversations WHERE account_low=? OR account_high=?',providerId,providerId).get<{n:number}>()!.n>=10000)throw new HttpError(409,'Dosáhli jste limitu konverzací.');
  const id=crypto.randomUUID();
  query('INSERT INTO conversations(id,request_id,provider_account_id,account_low,account_high,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',id,requestId,providerId,low,high,now,now).run();
  return id;
}

export function conversationList(user:User){
  const id=requireAccount(user).id;
  return query("SELECT c.id AS conversationId,c.request_id AS requestId,r.title AS requestTitle,COALESCE((SELECT '/api/media/'||ri.media_id||'/' FROM request_images ri WHERE ri.request_id=r.id ORDER BY ri.position LIMIT 1),'') AS requestPhoto,c.updated_at AS updatedAt,COALESCE((SELECT body FROM messages WHERE conversation_id=c.id ORDER BY created_at DESC,id DESC LIMIT 1),'Začněte konverzaci') AS lastMessage,"+
    " (SELECT COUNT(*) FROM messages m WHERE m.conversation_id=c.id AND m.sender_account_id<>? AND m.created_at>COALESCE(cr.last_read_at,'')) AS unread"+
    ' FROM conversations c JOIN requests r ON r.id=c.request_id'+
    ' LEFT JOIN conversation_reads cr ON cr.conversation_id=c.id AND cr.account_id=? WHERE (c.account_low=? OR c.account_high=?)'+
    ' AND EXISTS(SELECT 1 FROM chat_unlocks u WHERE u.request_id=c.request_id AND u.provider_account_id=c.provider_account_id)'+
    " AND EXISTS(SELECT 1 FROM offers o WHERE o.request_id=c.request_id AND o.provider_account_id=c.provider_account_id AND o.status='ACCEPTED')"+
    ' ORDER BY c.updated_at DESC,c.id DESC LIMIT 500',id,id,id,id).all<Conversation>();
}

export function messagePage(user:User,conversationId:string,before?:string):ChatPage{
  const id=requireAccount(user).id,thread=threadFor(id,conversationId);
  const cursor=before?query('SELECT created_at,id FROM messages WHERE id=? AND conversation_id=?',before,conversationId).get<{created_at:string;id:string}>():undefined;
  if(before&&!cursor)throw new HttpError(400,'Neplatná stránka zpráv.');
  const rows=query('SELECT id,sender_account_id AS senderAccountId,body,created_at AS createdAt FROM messages WHERE conversation_id=?'+
    (cursor?' AND (created_at<? OR (created_at=? AND id<?))':'')+' ORDER BY created_at DESC,id DESC LIMIT 51',conversationId,...(cursor?[cursor.created_at,cursor.created_at,cursor.id]:[])).all<{id:string;senderAccountId:string;body:string;createdAt:string}>();
  const more=rows.length>50,items=rows.slice(0,50).reverse().map(({senderAccountId,...message}):ChatMessage=>({...message,isOwn:senderAccountId===id}));
  return {requestId:thread.requestId,requestTitle:thread.requestTitle,requestPhoto:thread.requestPhoto,canSend:true,accepted:true,items,nextCursor:more?items[0].id:null};
}

export function sendMessage(user:User,conversationId:string,body:string,clientId:string){
  const account=requireAccount(user),id=account.id,thread=threadFor(id,conversationId);
  const existing=query('SELECT conversation_id,sender_account_id,body FROM messages WHERE id=?',clientId).get<{conversation_id:string;sender_account_id:string;body:string}>();
  if(existing){if(existing.conversation_id!==conversationId||existing.sender_account_id!==id||existing.body!==body)throw new HttpError(409,'Zprávu nelze odeslat s tímto identifikátorem.');return;}
  if(query('SELECT COUNT(*) AS n FROM messages WHERE sender_account_id=?',id).get<{n:number}>()!.n>=10000)throw new HttpError(409,'Dosáhli jste limitu zpráv.');
  const now=new Date().toISOString();
  if(query('SELECT COUNT(*) AS n FROM messages WHERE sender_account_id=? AND created_at>?',id,new Date(Date.now()-60000).toISOString()).get<{n:number}>()!.n>=30)throw new HttpError(429,'Posíláte zprávy příliš rychle. Za chvíli to zkuste znovu.');
  query('INSERT INTO messages(id,conversation_id,request_id,provider_account_id,sender_user_id,sender_account_id,body,created_at) VALUES(?,?,?,?,?,?,?,?)',clientId,conversationId,thread.requestId,thread.providerId,user.userId,id,body,now).run();
  query('UPDATE conversations SET updated_at=? WHERE id=?',now,conversationId).run();
}

export function messengerWrite(user:User,input:z.infer<typeof messengerAction>){
  const id=requireAccount(user).id;
  if(input.action==='start'){
    const offer=query("SELECT o.request_id AS requestId,o.provider_account_id AS providerId,r.customer_account_id AS customerId FROM offers o JOIN requests r ON r.id=o.request_id WHERE o.id=? AND o.status='ACCEPTED'",input.offerId).get<{requestId:string;providerId:string;customerId:string}>();
    if(!offer||id!==offer.providerId&&id!==offer.customerId)throw new HttpError(404,'Konverzace nebyla nalezena.');
    assertChatAccess(id,offer.requestId,offer.providerId,offer.customerId);
    return ensureConversation(offer.providerId,offer.requestId);
  }
  threadFor(id,input.conversationId);
  if(input.action==='send')sendMessage(user,input.conversationId,input.body,input.clientId);
  if(input.action==='read'){
    const message=query('SELECT created_at FROM messages WHERE id=? AND conversation_id=?',input.messageId,input.conversationId).get<{created_at:string}>();
    if(!message)throw new HttpError(404,'Zpráva nebyla nalezena.');
    query('INSERT INTO conversation_reads VALUES(?,?,?) ON CONFLICT(conversation_id,account_id) DO UPDATE SET last_read_at=max(last_read_at,excluded.last_read_at)',input.conversationId,id,message.created_at).run();
  }
  return input.conversationId;
}
