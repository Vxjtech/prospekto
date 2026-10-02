import 'server-only';
import {query} from '@/db';
import type {User} from '@/lib/auth';
import {requireAccount} from '@/lib/accounts/store';
import {HttpError} from '@/lib/http';
import type {z} from 'zod';
import type {marketplaceAction,MarketplaceState,MarketRequest,Lead,Task,Offer,Message,Provider,Thread,Review} from './model';
const requestColumns='r.id,r.title,r.description,r.service_id AS serviceId,r.city,r.region,r.status,r.budget_czk AS budgetCzk,r.created_at AS createdAt';
function relevant(accountId:string,requestId?:string) {
  // Exact cities, explicitly selected regions, or nationwide. Coordinates are reserved
  // for a future geocoder; never infer distance from a postcode or fabricate a radius.
  return query('SELECT '+requestColumns+
    " FROM requests r JOIN services s ON s.id=r.service_id JOIN service_areas a ON a.account_id=? WHERE r.status='OPEN' AND (? IS NULL OR r.id=?)"+
    ' AND EXISTS(SELECT 1 FROM provider_services ps JOIN services own ON own.id=ps.service_id WHERE ps.account_id=a.account_id AND (ps.service_id=r.service_id OR ps.service_id=s.parent_id OR own.parent_id=r.service_id))'+
    ' AND (a.nationwide=1 OR lower(a.city)=lower(r.city) OR EXISTS(SELECT 1 FROM json_each(a.cities) WHERE lower(value)=lower(r.city)) OR EXISTS(SELECT 1 FROM json_each(a.regions) WHERE value=r.region))'+
    ' ORDER BY r.created_at DESC LIMIT 200',accountId,requestId??null,requestId??null).all<MarketRequest>();
}
function existingRequest(id:string) {
  const row=query('SELECT customer_account_id,status FROM requests WHERE id=?',id).get<{customer_account_id:string;status:string}>();
  if(!row)throw new HttpError(404,'Poptávka nebyla nalezena.');
  return row;
}
export function marketState(user:User):MarketplaceState {
  const account=requireAccount(user),customer=account.type==='CUSTOMER',id=account.id;
  const requests=customer?query('SELECT '+requestColumns+' FROM requests r WHERE r.customer_account_id=? ORDER BY r.created_at DESC LIMIT 200',id).all<MarketRequest>():relevant(id);
  const leads=customer?[]:query('SELECT id,request_id AS requestId,title,contact_name AS contactName,stage,value_czk AS valueCzk,created_at AS createdAt,updated_at AS updatedAt FROM leads WHERE account_id=? ORDER BY updated_at DESC LIMIT 500',id).all<Lead>();
  const tasks=customer?[]:query('SELECT id,title,due_at AS dueAt,done FROM tasks WHERE account_id=? ORDER BY done,due_at,created_at DESC LIMIT 500',id).all<Task>();
  const offers=query('SELECT o.id,o.request_id AS requestId,o.provider_account_id AS providerId,a.name AS providerName,r.title AS requestTitle,o.body,o.amount_czk AS amountCzk,o.status FROM offers o JOIN requests r ON r.id=o.request_id JOIN accounts a ON a.id=o.provider_account_id WHERE '+(customer?'r.customer_account_id':'o.provider_account_id')+'=? ORDER BY o.created_at DESC LIMIT 500',id).all<Offer>();
  const messages=query('SELECT m.id,m.request_id AS requestId,m.provider_account_id AS providerId,m.sender_account_id AS senderAccountId,a.name AS senderName,m.body,m.created_at AS createdAt FROM messages m JOIN requests r ON r.id=m.request_id JOIN accounts a ON a.id=m.sender_account_id WHERE '+(customer?'r.customer_account_id':'m.provider_account_id')+'=? ORDER BY m.created_at DESC LIMIT 500',id).all<Message>();
  const providers=customer?query("SELECT a.id,a.name,p.description,COALESCE(s.city,'') AS city,p.avatar_url AS avatarUrl,p.website,"+
    ' EXISTS(SELECT 1 FROM favorites f WHERE f.provider_account_id=a.id AND f.customer_account_id=?) AS favorite,'+
    " COALESCE((SELECT group_concat(sv.name, ', ') FROM provider_services ps JOIN services sv ON sv.id=ps.service_id WHERE ps.account_id=a.id),'') AS serviceNames"+
    ' FROM accounts a JOIN provider_profiles p ON p.account_id=a.id LEFT JOIN service_areas s ON s.account_id=a.id WHERE a.completed_at IS NOT NULL ORDER BY a.name LIMIT 200',id).all<Provider>():[];
  const threads=query('SELECT l.request_id AS requestId,l.account_id AS providerId,a.name AS providerName,r.title AS requestTitle FROM leads l JOIN requests r ON r.id=l.request_id JOIN accounts a ON a.id=l.account_id WHERE '+(customer?'r.customer_account_id':'l.account_id')+'=? ORDER BY l.updated_at DESC LIMIT 500',id).all<Thread>();
  const reviews=query('SELECT v.id,v.rating,v.body,a.name AS providerName FROM reviews v JOIN accounts a ON a.id=v.provider_account_id WHERE '+(customer?'v.customer_account_id':'v.provider_account_id')+'=? ORDER BY v.created_at DESC LIMIT 200',id).all<Review>();
  const summary=customer?{newLeads:0,activeLeads:0,offers:offers.length,won:0,pipelineValue:0}:query("SELECT COUNT(CASE WHEN stage='NEW' THEN 1 END) AS newLeads,COUNT(CASE WHEN stage NOT IN ('WON','LOST') THEN 1 END) AS activeLeads,(SELECT COUNT(*) FROM offers WHERE provider_account_id=?) AS offers,COUNT(CASE WHEN stage='WON' THEN 1 END) AS won,COALESCE(SUM(CASE WHEN stage NOT IN ('WON','LOST') THEN value_czk ELSE 0 END),0) AS pipelineValue FROM leads WHERE account_id=?",id,id).get<MarketplaceState['summary']>()!;
  return {summary,requests,leads,tasks,offers,messages,providers,threads,reviews};
}
export function marketAction(user:User,input:z.infer<typeof marketplaceAction>) {
  const customerActions=['request','close-request','accept-offer','review','favorite'];
  const account=requireAccount(user,input.action==='message'?undefined:customerActions.includes(input.action)?'customer':'provider');
  const id=account.id,now=new Date().toISOString();
  const providerLead=(requestId:string)=>{
    const r=existingRequest(requestId);
    if(!query('SELECT 1 FROM leads WHERE account_id=? AND request_id=?',id,requestId).get())throw new HttpError(404,'Poptávka není mezi vašimi leady.');
    return r;
  };
  const limit=(table:'requests'|'leads'|'tasks'|'offers'|'messages')=>{
    const column=table==='requests'?'customer_account_id':table==='offers'?'provider_account_id':table==='messages'?'sender_account_id':'account_id';
    if((query('SELECT COUNT(*) AS n FROM '+table+' WHERE '+column+'=?',id).get<{n:number}>()?.n??0)>=10000)throw new HttpError(409,'Dosáhli jste limitu záznamů v účtu.');
  };
  if(input.action==='request'){
    if(!query('SELECT 1 FROM services WHERE id=?',input.serviceId).get())throw new HttpError(400,'Vyberte platnou službu.');
    limit('requests');query('INSERT INTO requests(id,customer_account_id,title,description,service_id,city,region,budget_czk,created_at) VALUES(?,?,?,?,?,?,?,?,?)',crypto.randomUUID(),id,input.title,input.description,input.serviceId,input.city,input.region,input.budgetCzk,now).run();
  }
  if(input.action==='close-request'){
    if(!query("UPDATE requests SET status='CLOSED' WHERE id=? AND customer_account_id=?",input.id,id).run().changes)throw new HttpError(404,'Poptávka nebyla nalezena.');
  }
  if(input.action==='interest'){
    const r=relevant(id,input.requestId)[0];if(!r)throw new HttpError(404,'Poptávka není dostupná pro váš obor a lokalitu.');
    limit('leads');query('INSERT INTO leads(id,account_id,request_id,title,created_at,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(account_id,request_id) DO NOTHING',crypto.randomUUID(),id,r.id,r.title,now,now).run();
  }
  if(input.action==='lead'){limit('leads');query('INSERT INTO leads(id,account_id,title,contact_name,value_czk,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',crypto.randomUUID(),id,input.title,input.contactName,input.valueCzk,now,now).run();}
  if(input.action==='stage'){
    if(!query('UPDATE leads SET stage=?,updated_at=? WHERE id=? AND account_id=?',input.stage,now,input.id,id).run().changes)throw new HttpError(404,'Lead nebyl nalezen.');
  }
  if(input.action==='task'){limit('tasks');query('INSERT INTO tasks(id,account_id,title,due_at,created_at) VALUES(?,?,?,?,?)',crypto.randomUUID(),id,input.title,input.dueAt,now).run();}
  if(input.action==='task-done'){
    if(!query('UPDATE tasks SET done=? WHERE id=? AND account_id=?',Number(input.done),input.id,id).run().changes)throw new HttpError(404,'Úkol nebyl nalezen.');
  }
  if(input.action==='offer'){
    const r=providerLead(input.requestId);if(r.status!=='OPEN')throw new HttpError(409,'Poptávka již není otevřená.');
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
  if(input.action==='message'){
    const r=existingRequest(input.requestId);
    if(account.type==='CUSTOMER'?r.customer_account_id!==id:input.providerId!==id)throw new HttpError(404,'Konverzace nebyla nalezena.');
    if(!query('SELECT 1 FROM leads WHERE request_id=? AND account_id=?',input.requestId,input.providerId).get())throw new HttpError(404,'Konverzace nebyla nalezena.');
    limit('messages');query('INSERT INTO messages(id,request_id,provider_account_id,sender_user_id,sender_account_id,body,created_at) VALUES(?,?,?,?,?,?,?)',crypto.randomUUID(),input.requestId,input.providerId,user.userId,id,input.body,now).run();
  }
  if(input.action==='review'){
    const o=query("SELECT o.provider_account_id FROM offers o JOIN requests r ON r.id=o.request_id WHERE o.request_id=? AND r.customer_account_id=? AND r.status='CLOSED' AND o.status='ACCEPTED'",input.requestId,id).get<{provider_account_id:string}>();
    if(!o)throw new HttpError(403,'Hodnotit můžete vybraného dodavatele po dokončení poptávky.');
    if(query('SELECT 1 FROM reviews WHERE request_id=? AND customer_account_id=?',input.requestId,id).get())throw new HttpError(409,'Tuto zakázku jste již hodnotili.');
    query('INSERT INTO reviews(id,request_id,customer_account_id,provider_account_id,rating,body,created_at) VALUES(?,?,?,?,?,?,?)',crypto.randomUUID(),input.requestId,id,o.provider_account_id,input.rating,input.body,now).run();
  }
  if(input.action==='favorite'){
    if(!query('SELECT 1 FROM provider_profiles p JOIN accounts a ON a.id=p.account_id WHERE a.id=? AND a.completed_at IS NOT NULL',input.providerId).get())throw new HttpError(404,'Dodavatel nebyl nalezen.');
    if(input.enabled)query('INSERT INTO favorites VALUES(?,?) ON CONFLICT DO NOTHING',id,input.providerId).run();
    else query('DELETE FROM favorites WHERE customer_account_id=? AND provider_account_id=?',id,input.providerId).run();
  }
}
