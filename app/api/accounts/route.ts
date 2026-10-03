import {z} from 'zod';
import {transaction} from '@/db';
import {getUser,switchAccount} from '@/lib/auth';
import {HttpError,json,readJson,requireSameOrigin} from '@/lib/http';
import {accountAction,destination} from '@/lib/accounts/model';
import {createAccount,getContext,saveStep,selectType} from '@/lib/accounts/store';
export const dynamic='force-dynamic';
export async function GET() {
  const user=await getUser();
  if(!user)return json({error:'Přihlaste se.'},401);
  return json(getContext(user));
}
export async function POST(request:Request) {
  try {
    requireSameOrigin(request);
    const user=await getUser();
    if(!user)throw new HttpError(401,'Přihlaste se.');
    const input=accountAction.parse(await readJson(request));
    let accountId=user.activeAccountId;
    if(input.action==='switch') accountId=input.accountId;
    if(input.action==='choose') {
      accountId=transaction(()=>{
        const ctx=getContext(user);
        if(!input.newContext&&ctx.account&&!ctx.account.type){selectType(user.userId,ctx.account.id,input.type);return ctx.account.id;}
        if(ctx.account&&!input.newContext)throw new HttpError(409,'Typ účtu je již nastavený.');
        if(ctx.accounts.length>=10)throw new HttpError(409,'Můžete mít nejvýše 10 prostředí.');
        return createAccount(user.userId,input.type,user.fullName??user.email);
      });
    }
    if(input.action==='step') transaction(()=>saveStep(user,input.step,input.data));
    if(accountId&&input.action!=='step') await switchAccount(user,accountId);
    const fresh=await getUser();
    if(!fresh)throw new HttpError(401,'Přihlášení vypršelo.');
    return json({ok:true,redirectTo:destination(getContext(fresh))});
  } catch(error) {
    if(error instanceof z.ZodError)return json({error:error.issues[0]?.message??'Zkontrolujte údaje.'},400);
    if(error instanceof HttpError)return json({error:error.message},error.status);
    console.error('Account operation failed',error instanceof Error?error.name:'unknown');
    return json({error:'Změny se nepodařilo uložit. Zkuste to znovu.'},503);
  }
}
