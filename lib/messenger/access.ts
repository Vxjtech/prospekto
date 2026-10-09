import 'server-only';
import {query} from '@/db';
import {HttpError} from '@/lib/http';
export const CHAT_PRICE=49;
export function creditBalance(accountId:string){
  return query('SELECT COALESCE(SUM(amount),0) AS balance FROM credit_entries WHERE account_id=?',accountId).get<{balance:number}>()!.balance;
}
export function chatAccess(providerId:string,customerId:string,requestId:string){
  const accepted=providerId!==customerId&&!!query("SELECT 1 FROM offers o JOIN requests r ON r.id=o.request_id WHERE o.request_id=? AND o.provider_account_id=? AND r.customer_account_id=? AND o.status='ACCEPTED'",requestId,providerId,customerId).get();
  const paid=!!query('SELECT 1 FROM chat_unlocks WHERE provider_account_id=? AND customer_account_id=? AND request_id=?',providerId,customerId,requestId).get();
  return {allowed:accepted&&paid,accepted};
}
export function assertChatAccess(accountId:string,requestId:string,providerId:string,customerId:string){
  if(accountId!==providerId&&accountId!==customerId)throw new HttpError(404,'Konverzace nebyla nalezena.');
  const access=chatAccess(providerId,customerId,requestId);
  if(!access.accepted)throw new HttpError(403,'Chat je dostupný až po přijetí nabídky zákazníkem. Přejděte do Nabídek.');
  if(!access.allowed)throw new HttpError(402,'Dodavatel musí nejprve odemknout chat v Nabídkách za 49 kreditů.');
}
export function unlockChat(providerId:string,offerId:string){
  const offer=query("SELECT r.customer_account_id AS customerId,o.request_id AS requestId,o.status FROM offers o JOIN requests r ON r.id=o.request_id WHERE o.id=? AND o.provider_account_id=?",offerId,providerId).get<{customerId:string;requestId:string;status:string}>();
  if(!offer)throw new HttpError(404,'Nabídka nebyla nalezena.');
  if(offer.status!=='ACCEPTED')throw new HttpError(409,'Chat můžete odemknout až po přijetí nabídky zákazníkem.');
  if(chatAccess(providerId,offer.customerId,offer.requestId).allowed)return offer.requestId;
  if(creditBalance(providerId)<CHAT_PRICE)throw new HttpError(402,'Na odemknutí chatu potřebujete 49 kreditů. Nemáte dostatečný zůstatek.');
  const entryId=crypto.randomUUID(),now=new Date().toISOString();
  // The caller holds BEGIN IMMEDIATE: balance check, debit and unlock commit together.
  query('INSERT INTO credit_entries(id,account_id,amount,reason,idempotency_key,created_at) VALUES(?,?,?,?,?,?)',entryId,providerId,-CHAT_PRICE,'CHAT_UNLOCK','chat:'+JSON.stringify([providerId,offer.requestId]),now).run();
  query('INSERT INTO chat_unlocks(provider_account_id,customer_account_id,request_id,offer_id,credit_entry_id,created_at) VALUES(?,?,?,?,?,?)',providerId,offer.customerId,offer.requestId,offerId,entryId,now).run();
  return offer.requestId;
}
