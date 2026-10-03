import {z} from 'zod';
import {transaction} from '@/db';
import {getUser} from '@/lib/auth';
import {json,readJson,requireSameOrigin,HttpError} from '@/lib/http';
import {jobAction} from '@/lib/jobs/model';
import {publicJobs,employerJobs,applications,saveJob,closeJob,applyToJob} from '@/lib/jobs/store';
export const dynamic='force-dynamic';
function failure(error:unknown){
 if(error instanceof HttpError)return json({error:error.message},error.status);
 if(error instanceof z.ZodError)return json({error:error.issues[0]?.message??'Zkontrolujte údaje.'},400);
 console.error('Jobs operation failed',error instanceof Error?error.name:'unknown');
 return json({error:'Pracovní nabídky se nepodařilo načíst nebo uložit.'},503);
}
export async function GET(request:Request){
 try{
  const params=new URL(request.url).searchParams,scope=params.get('scope');
  if(!scope)return json(publicJobs(params));
  const user=await getUser();if(!user)throw new HttpError(401,'Přihlaste se.');
  if(scope==='mine')return json({items:employerJobs(user)});
  if(scope==='applications')return json({items:applications(user)});
  throw new HttpError(400,'Neplatný požadavek.');
 }catch(error){return failure(error);}
}
export async function POST(request:Request){
 try{
  requireSameOrigin(request);const user=await getUser();if(!user)throw new HttpError(401,'Přihlaste se.');
  const input=jobAction.parse(await readJson(request,65536));
  const id=transaction(()=>{
   if(input.action==='save')return saveJob(user,input.data,input.id);
   if(input.action==='close')closeJob(user,input.id);
   if(input.action==='apply')applyToJob(user,input.data);
   return null;
  });
  return json({ok:true,id});
 }catch(error){return failure(error);}
}
