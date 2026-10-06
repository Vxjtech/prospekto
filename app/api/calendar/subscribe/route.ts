import {randomBytes} from 'node:crypto';
import {transaction,query} from '@/db';
import {getUser} from '@/lib/auth';
import {requireAccount} from '@/lib/accounts/store';
import {appOrigin,HttpError,json} from '@/lib/http';
export const dynamic='force-dynamic';

export async function GET(request:Request){
 try{
  const user=await getUser();if(!user)throw new HttpError(401,'Přihlaste se pro připojení kalendáře.');
  const account=requireAccount(user,'provider');
  const token=transaction(()=>{
   const existing=query('SELECT token FROM calendar_subscriptions WHERE account_id=?',account.id).get<{token:string}>();
   if(existing)return existing.token;
   const value=randomBytes(32).toString('base64url');
   query('INSERT INTO calendar_subscriptions(account_id,token,created_at) VALUES(?,?,?)',account.id,value,new Date().toISOString()).run();
   return value;
  });
  const feed=new URL(`/api/calendar/feed/${token}/`,appOrigin(request)).toString().replace(/^https?:/,'webcal:');
  return new Response(null,{status:302,headers:{Location:feed,'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
 }catch(error){
  if(error instanceof HttpError)return json({error:error.message},error.status);
  console.error('Calendar subscription setup failed',error instanceof Error?error.name:'unknown');
  return json({error:'Připojení kalendáře se nepodařilo připravit. Zkuste to znovu.'},503);
 }
}
