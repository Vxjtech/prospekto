import 'server-only';
import {query} from '@/db';
import type {User} from '@/lib/auth';
import {requireAccount} from '@/lib/accounts/store';
import {HttpError} from '@/lib/http';
import {z} from 'zod';
import {CZECH_REGIONS,normalizeSearch} from '@/lib/company-types';
import {creditBalance,chatAccess,unlockChat} from '@/lib/messenger/access';
import {ensureConversation,sendMessage} from '@/lib/messenger/store';
import type {marketplaceAction,MarketplaceState,MarketRequest,Lead,Task,Offer,Message,Provider,Review} from './model';
const requestColumns='r.customer_account_id AS requesterId,(SELECT type FROM accounts WHERE id=r.customer_account_id) AS requesterType,r.cooperation_type AS cooperationType,r.id,r.title,r.description,r.service_id AS serviceId,r.city,r.region,r.status,r.budget_czk AS budgetCzk,r.created_at AS createdAt';
const matching=" EXISTS(SELECT 1 FROM provider_services ps JOIN services own ON own.id=ps.service_id WHERE ps.account_id=? AND (ps.service_id=r.service_id OR ps.service_id=s.parent_id OR own.parent_id=r.service_id)) AND EXISTS(SELECT 1 FROM service_areas a WHERE a.account_id=? AND (a.nationwide=1 OR lower(a.city)=lower(r.city) OR EXISTS(SELECT 1 FROM json_each(a.cities) WHERE lower(value)=lower(r.city)) OR EXISTS(SELECT 1 FROM json_each(a.regions) WHERE value=r.region)))";
function requestPhotos(items:MarketRequest[]):MarketRequest[] {
  if(!items.length)return items;
  const byRequest=new Map<string,string[]>();
  const ids=items.map(item=>item.id);
  const images=query(`SELECT request_id AS requestId,media_id AS mediaId FROM request_images WHERE request_id IN (${ids.map(()=>'?').join(',')}) ORDER BY request_id,position`,...ids).all<{requestId:string;mediaId:string}>();
  for(const image of images)byRequest.set(image.requestId,[...(byRequest.get(image.requestId)??[]),'/api/media/'+image.mediaId+'/']);
  return items.map(item=>({...item,photos:byRequest.get(item.id)??[]}));
}
export function requestFeed(user:User,params:URLSearchParams){
  const account=requireAccount(user,'provider');
  const input=z.object({scope:z.enum(['all','recommended']).default('all'),q:z.string().trim().max(160).default(''),service:z.string().max(100).default(''),region:z.string().max(100).default(''),requesterType:z.enum(['','CUSTOMER','COMPANY']).default(''),cooperationType:z.enum(['','ONE_OFF','LONG_TERM']).default(''),page:z.coerce.number().int().min(1).max(100000).default(1)}).parse(Object.fromEntries(params));
  if(input.service&&!query('SELECT 1 FROM services WHERE id=?',input.service).get())throw new HttpError(400,'Vyberte platný obor.');
  if(input.region&&!CZECH_REGIONS.some(r=>r.id===input.region))throw new HttpError(400,'Vyberte platný kraj.');
  const clauses=["r.status='OPEN'",'r.customer_account_id<>?'],values:(string|number)[]=[account.id];
  if(input.requesterType){clauses.push('(SELECT type FROM accounts WHERE id=r.customer_account_id)=?');values.push(input.requesterType);}
  if(input.cooperationType){clauses.push('r.cooperation_type=?');values.push(input.cooperationType);}
  if(input.scope==='recommended'){clauses.push(matching);values.push(account.id,account.id);}
  if(input.service){clauses.push('(r.service_id=? OR s.parent_id=?)');values.push(input.service,input.service);}
  if(input.region){clauses.push('r.region=?');values.push(input.region);}
  if(input.q){clauses.push("instr(normalize_text(r.title||' '||r.city||' '||r.description),?)>0");values.push(normalizeSearch(input.q));}
  const from=' FROM requests r JOIN services s ON s.id=r.service_id WHERE '+clauses.join(' AND ');
  const total=query('SELECT COUNT(*) AS n'+from,...values).get<{n:number}>()!.n;
  const page=Math.min(input.page,Math.max(1,Math.ceil(total/20)));
  const items=requestPhotos(query('SELECT '+requestColumns+from+' ORDER BY r.created_at DESC,r.id DESC LIMIT 20 OFFSET ?',...values,(page-1)*20).all<MarketRequest>());
  return {items,total,page,pages:Math.max(1,Math.ceil(total/20))};
}
function relevant(accountId:string){
  return requestPhotos(query('SELECT '+requestColumns+" FROM requests r JOIN services s ON s.id=r.service_id WHERE r.status='OPEN' AND r.customer_account_id<>? AND "+matching+' ORDER BY r.created_at DESC,r.id DESC LIMIT 200',accountId,accountId,accountId).all<MarketRequest>());
}
function existingRequest(id:string) {
  const row=query('SELECT customer_account_id,status,title FROM requests WHERE id=?',id).get<{customer_account_id:string;status:string;title:string}>();
  if(!row)throw new HttpError(404,'Poptávka nebyla nalezena.');
  return row;
}
export function marketState(user:User):MarketplaceState {
  const account=requireAccount(user),customer=account.type==='CUSTOMER',id=account.id;
  const ownRequests=requestPhotos(query('SELECT '+requestColumns+' FROM requests r WHERE r.customer_account_id=? ORDER BY r.created_at DESC LIMIT 200',id).all<MarketRequest>());
  const requests=customer?ownRequests:relevant(id);
  const leads=customer?[]:query('SELECT id,request_id AS requestId,title,contact_name AS contactName,stage,value_czk AS valueCzk,created_at AS createdAt,updated_at AS updatedAt FROM leads WHERE account_id=? ORDER BY updated_at DESC LIMIT 500',id).all<Lead>();
  const tasks=customer?[]:query('SELECT id,title,due_at AS dueAt,done FROM tasks WHERE account_id=? ORDER BY done,due_at,created_at DESC LIMIT 500',id).all<Task>();
  const accountOffers=query('SELECT o.id,o.request_id AS requestId,o.provider_account_id AS providerId,a.name AS providerName,r.title AS requestTitle,o.body,o.amount_czk AS amountCzk,o.status,r.customer_account_id AS customerId FROM offers o JOIN requests r ON r.id=o.request_id JOIN accounts a ON a.id=o.provider_account_id WHERE (r.customer_account_id=? OR o.provider_account_id=?) ORDER BY o.created_at DESC LIMIT 1000',id,id).all<Offer & {customerId:string}>();
  const withAccess=(offer:Offer & {customerId:string})=>({...offer,chatUnlocked:chatAccess(offer.providerId,offer.customerId,offer.requestId).allowed});
  const receivedOffers=accountOffers.filter(o=>o.customerId===id).map(withAccess);
  const offers=customer?receivedOffers:accountOffers.filter(o=>o.providerId===id).map(withAccess);
  const messages=query('SELECT m.id FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.account_low=? OR c.account_high=? ORDER BY m.created_at DESC,m.id DESC LIMIT 500',id,id).all<Message>();
  const providers=query("SELECT a.id,a.name,p.description,COALESCE(s.city,'') AS city,p.avatar_url AS avatarUrl,p.website,"+
    ' EXISTS(SELECT 1 FROM favorites f WHERE f.provider_account_id=a.id AND f.customer_account_id=?) AS favorite,'+
    " COALESCE((SELECT group_concat(sv.name, ', ') FROM provider_services ps JOIN services sv ON sv.id=ps.service_id WHERE ps.account_id=a.id),'') AS serviceNames"+
    ' FROM accounts a JOIN provider_profiles p ON p.account_id=a.id LEFT JOIN service_areas s ON s.account_id=a.id WHERE a.completed_at IS NOT NULL AND a.id<>? ORDER BY a.name LIMIT 200',id,id).all<Provider>();
  const reviews=query('SELECT v.id,v.request_id AS requestId,v.rating,v.body,a.name AS providerName FROM reviews v JOIN accounts a ON a.id=v.provider_account_id WHERE '+(customer?'v.customer_account_id':'v.provider_account_id')+'=? ORDER BY v.created_at DESC LIMIT 200',id).all<Review>();
  const givenReviews=query('SELECT v.id,v.request_id AS requestId,v.rating,v.body,a.name AS providerName FROM reviews v JOIN accounts a ON a.id=v.provider_account_id WHERE v.customer_account_id=? ORDER BY v.created_at DESC LIMIT 200',id).all<Review>();
  const customerReviews=customer?query('SELECT cr.id,cr.request_id AS requestId,r.title AS requestTitle,cr.rating,cr.body,a.name AS providerName FROM customer_reviews cr JOIN accounts a ON a.id=cr.provider_account_id JOIN requests r ON r.id=cr.request_id WHERE cr.customer_account_id=? ORDER BY cr.created_at DESC LIMIT 200',id).all<MarketplaceState['customerReviews'][number]>():[];
  const customerReviewRequests=customer?[]:query("SELECT r.id AS requestId,r.title FROM requests r JOIN offers o ON o.request_id=r.id JOIN accounts c ON c.id=r.customer_account_id AND c.type='CUSTOMER' WHERE o.provider_account_id=? AND o.status='ACCEPTED' AND r.status='CLOSED' AND NOT EXISTS(SELECT 1 FROM customer_reviews cr WHERE cr.request_id=r.id) ORDER BY r.created_at DESC LIMIT 200",id).all<MarketplaceState['customerReviewRequests'][number]>();
  const summary=customer?{newLeads:0,activeLeads:0,offers:offers.length,won:0,pipelineValue:0}:query("SELECT COUNT(CASE WHEN stage='NEW' THEN 1 END) AS newLeads,COUNT(CASE WHEN stage NOT IN ('WON','LOST') THEN 1 END) AS activeLeads,(SELECT COUNT(*) FROM offers WHERE provider_account_id=?) AS offers,COUNT(CASE WHEN stage='WON' THEN 1 END) AS won,COALESCE(SUM(CASE WHEN stage NOT IN ('WON','LOST') THEN value_czk ELSE 0 END),0) AS pipelineValue FROM leads WHERE account_id=?",id,id).get<MarketplaceState['summary']>()!;
  return {credits:creditBalance(id),summary,ownRequests,receivedOffers,givenReviews,customerReviews,customerReviewRequests,requests,leads,tasks,offers,messages,providers,reviews};
}
export function marketAction(user:User,input:z.infer<typeof marketplaceAction>) {
  const requesterActions=['request','close-request','accept-offer','review','favorite'];
  const account=requireAccount(user,input.action==='message'||requesterActions.includes(input.action)?undefined:'provider');
  const id=account.id,now=new Date().toISOString();
  const limit=(table:'requests'|'leads'|'tasks'|'offers'|'messages')=>{
    const column=table==='requests'?'customer_account_id':table==='offers'?'provider_account_id':table==='messages'?'sender_account_id':'account_id';
    if((query('SELECT COUNT(*) AS n FROM '+table+' WHERE '+column+'=?',id).get<{n:number}>()?.n??0)>=10000)throw new HttpError(409,'Dosáhli jste limitu záznamů v účtu.');
  };
  const ensureLead=(requestId:string)=>{
    const r=existingRequest(requestId);
    if(r.customer_account_id===id)throw new HttpError(403,'Na vlastní poptávku nemůžete poslat nabídku.');
    if(r.status!=='OPEN')throw new HttpError(409,'Poptávka už není otevřená. Vyberte jinou poptávku.');
    if(!query('SELECT 1 FROM leads WHERE account_id=? AND request_id=?',id,requestId).get()){
      limit('leads');
      query('INSERT INTO leads(id,account_id,request_id,title,created_at,updated_at) VALUES(?,?,?,?,?,?)',crypto.randomUUID(),id,requestId,r.title,now,now).run();
    }
    return r;
  };
  if(input.action==='request'){
    if(!query('SELECT 1 FROM services WHERE id=?',input.serviceId).get())throw new HttpError(400,'Vyberte platnou službu.');
    const mediaIds=input.photos.map(url=>url.slice('/api/media/'.length,-1));
    if(mediaIds.some(mediaId=>!query('SELECT 1 FROM media_assets WHERE id=? AND account_id=?',mediaId,id).get()))throw new HttpError(400,'Fotografie musí být nahrané do vašeho účtu.');
    limit('requests');
    const requestId=crypto.randomUUID();
    query('INSERT INTO requests(id,customer_account_id,title,description,service_id,city,region,budget_czk,created_at,cooperation_type) VALUES(?,?,?,?,?,?,?,?,?,?)',requestId,id,input.title,input.description,input.serviceId,input.city,input.region,input.budgetCzk,now,input.cooperationType).run();
    mediaIds.forEach((mediaId,position)=>query('INSERT INTO request_images(request_id,media_id,position) VALUES(?,?,?)',requestId,mediaId,position).run());
  }
  if(input.action==='close-request'){
    if(!query("UPDATE requests SET status='CLOSED' WHERE id=? AND customer_account_id=?",input.id,id).run().changes)throw new HttpError(404,'Poptávka nebyla nalezena.');
  }
  if(input.action==='interest'||input.action==='lead')throw new HttpError(410,'Leady byly sloučeny s Nabídkami. Pošlete nabídku zdarma přímo z poptávky.');
  if(input.action==='stage'){
    if(!query('UPDATE leads SET stage=?,updated_at=? WHERE id=? AND account_id=?',input.stage,now,input.id,id).run().changes)throw new HttpError(404,'Lead nebyl nalezen.');
  }
  if(input.action==='task'){limit('tasks');query('INSERT INTO tasks(id,account_id,title,due_at,created_at) VALUES(?,?,?,?,?)',crypto.randomUUID(),id,input.title,input.dueAt,now).run();}
  if(input.action==='task-done'){
    if(!query('UPDATE tasks SET done=? WHERE id=? AND account_id=?',Number(input.done),input.id,id).run().changes)throw new HttpError(404,'Úkol nebyl nalezen.');
  }
  if(input.action==='offer'){
    ensureLead(input.requestId);
    limit('offers');query('INSERT INTO offers(id,request_id,provider_account_id,body,amount_czk,created_at) VALUES(?,?,?,?,?,?)',crypto.randomUUID(),input.requestId,id,input.body,input.amountCzk,now).run();
    query("UPDATE leads SET stage='OFFER',value_czk=?,updated_at=? WHERE account_id=? AND request_id=?",input.amountCzk,now,id,input.requestId).run();
  }
  if(input.action==='accept-offer'){
    const o=query('SELECT o.request_id,o.provider_account_id,o.status,r.status AS request_status FROM offers o JOIN requests r ON r.id=o.request_id WHERE o.id=? AND r.customer_account_id=?',input.id,id).get<{request_id:string;provider_account_id:string;status:string;request_status:string}>();
    if(!o)throw new HttpError(404,'Nabídka nebyla nalezena.');
    if(o.status!=='SENT'||o.request_status!=='OPEN')throw new HttpError(409,'Dodavatel už byl vybraný nebo je poptávka uzavřená.');
    query("UPDATE offers SET status=CASE WHEN id=? THEN 'ACCEPTED' ELSE 'REJECTED' END WHERE request_id=?",input.id,o.request_id).run();
    query("UPDATE requests SET status='ASSIGNED' WHERE id=?",o.request_id).run();
    query("UPDATE leads SET stage=CASE WHEN account_id=? THEN 'WON' ELSE 'LOST' END,updated_at=? WHERE request_id=?",o.provider_account_id,now,o.request_id).run();
  }
  if(input.action==='unlock-chat')ensureConversation(id,unlockChat(id,input.id));
  if(input.action==='message'){
    const r=existingRequest(input.requestId);
    if(r.customer_account_id!==id&&input.providerId!==id)throw new HttpError(404,'Konverzace nebyla nalezena.');
    if(!query('SELECT 1 FROM leads WHERE request_id=? AND account_id=?',input.requestId,input.providerId).get())throw new HttpError(404,'Konverzace nebyla nalezena.');
    const conversationId=ensureConversation(input.providerId,input.requestId);
    sendMessage(user,conversationId,input.body,crypto.randomUUID());
  }
  if(input.action==='review'){
    const o=query("SELECT o.provider_account_id FROM offers o JOIN requests r ON r.id=o.request_id WHERE o.request_id=? AND r.customer_account_id=? AND r.status='CLOSED' AND o.status='ACCEPTED'",input.requestId,id).get<{provider_account_id:string}>();
    if(!o)throw new HttpError(403,'Hodnotit můžete vybraného dodavatele po dokončení poptávky.');
    if(query('SELECT 1 FROM reviews WHERE request_id=? AND customer_account_id=?',input.requestId,id).get())throw new HttpError(409,'Tuto zakázku jste již hodnotili.');
    query('INSERT INTO reviews(id,request_id,customer_account_id,provider_account_id,rating,body,created_at) VALUES(?,?,?,?,?,?,?)',crypto.randomUUID(),input.requestId,id,o.provider_account_id,input.rating,input.body,now).run();
  }
  if(input.action==='review-customer'){
    const r=query("SELECT r.customer_account_id FROM requests r JOIN offers o ON o.request_id=r.id JOIN accounts c ON c.id=r.customer_account_id AND c.type='CUSTOMER' WHERE r.id=? AND o.provider_account_id=? AND r.status='CLOSED' AND o.status='ACCEPTED'",input.requestId,id).get<{customer_account_id:string}>();
    if(!r)throw new HttpError(403,'Hodnotit zákazníka můžete po dokončení zakázky, kterou jste získali.');
    if(query('SELECT 1 FROM customer_reviews WHERE request_id=?',input.requestId).get())throw new HttpError(409,'Tuto zakázku jste již hodnotili.');
    query('INSERT INTO customer_reviews(id,request_id,customer_account_id,provider_account_id,rating,body,created_at) VALUES(?,?,?,?,?,?,?)',crypto.randomUUID(),input.requestId,r.customer_account_id,id,input.rating,input.body,now).run();
  }
  if(input.action==='favorite'){
    if(input.providerId===id)throw new HttpError(400,'Vlastní účet nelze uložit jako dodavatele.');
    if(!query('SELECT 1 FROM provider_profiles p JOIN accounts a ON a.id=p.account_id WHERE a.id=? AND a.completed_at IS NOT NULL',input.providerId).get())throw new HttpError(404,'Dodavatel nebyl nalezen.');
    if(input.enabled)query('INSERT INTO favorites VALUES(?,?) ON CONFLICT DO NOTHING',id,input.providerId).run();
    else query('DELETE FROM favorites WHERE customer_account_id=? AND provider_account_id=?',id,input.providerId).run();
  }
}
