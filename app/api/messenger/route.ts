import {z} from 'zod';
import {transaction} from '@/db';
import {getUser} from '@/lib/auth';
import {HttpError,json,readJson,requireSameOrigin} from '@/lib/http';
import {messengerAction} from '@/lib/messenger/model';
import {contacts,conversationList,messagePage,messengerWrite} from '@/lib/messenger/store';
export const dynamic='force-dynamic';
function failure(error:unknown){
  if(error instanceof HttpError)return json({error:error.message},error.status);
  if(error instanceof z.ZodError)return json({error:error.issues[0]?.message??'Zkontrolujte zprávu.'},400);
  console.error('Messenger operation failed',error instanceof Error?error.name:'unknown');
  return json({error:'Zprávy se nepodařilo načíst nebo uložit. Zkuste to znovu.'},503);
}
export async function GET(request:Request){try{
  const user=await getUser();if(!user)throw new HttpError(401,'Přihlaste se.');
  const p=new URL(request.url).searchParams;
  if(p.get('scope')==='contacts')return json({contacts:contacts(user,p.get('q')??'')});
  if(p.has('conversationId'))return json(messagePage(user,p.get('conversationId')!.slice(0,100),p.get('before')?.slice(0,100)));
  return json({conversations:conversationList(user)});
}catch(error){return failure(error);}}
export async function POST(request:Request){try{
  requireSameOrigin(request);const user=await getUser();if(!user)throw new HttpError(401,'Přihlaste se.');
  const data=messengerAction.parse(await readJson(request));
  return json({conversationId:transaction(()=>messengerWrite(user,data))});
}catch(error){return failure(error);}}
