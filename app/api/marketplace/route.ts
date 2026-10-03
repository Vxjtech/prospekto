import {z} from 'zod';
import {transaction} from '@/db';
import {getUser} from '@/lib/auth';
import {HttpError,json,readJson,requireSameOrigin} from '@/lib/http';
import {marketplaceAction} from '@/lib/marketplace/model';
import {marketAction,marketState,requestFeed} from '@/lib/marketplace/store';
export const dynamic='force-dynamic';
function failure(error:unknown) {
  if(error instanceof HttpError)return json({error:error.message},error.status);
  if(error instanceof z.ZodError)return json({error:error.issues[0]?.message??'Zkontrolujte údaje.'},400);
  console.error('Marketplace operation failed',error instanceof Error?error.name:'unknown');
  return json({error:'Data se nepodařilo uložit nebo načíst. Zkuste to znovu.'},503);
}
export async function GET(request:Request) {try{const user=await getUser();if(!user)throw new HttpError(401,'Přihlaste se.');const params=new URL(request.url).searchParams;if(params.has('scope'))return json(requestFeed(user,params));return json({state:marketState(user)});}catch(error){return failure(error);}}
export async function POST(request:Request) {
  try {
    requireSameOrigin(request);const user=await getUser();if(!user)throw new HttpError(401,'Přihlaste se.');
    const data=marketplaceAction.parse(await readJson(request));
    transaction(()=>marketAction(user,data));
    return json({ok:true,state:marketState(user)});
  }catch(error){return failure(error);}
}

