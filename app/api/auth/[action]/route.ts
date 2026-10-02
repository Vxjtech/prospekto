import {z} from 'zod';
import {query,transaction} from '@/db';
import {endSession,getUser,limitAuth,passwordHash,startSession,verifyPassword} from '@/lib/auth';
import {HttpError,json,readJson,requireSameOrigin} from '@/lib/http';
import {accountTypeInput,destination,personalInput} from '@/lib/accounts/model';
import {createAccount,getContext} from '@/lib/accounts/store';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const credentials=z.object({email:z.string().trim().email().max(254).transform(v=>v.toLowerCase()),password:z.string().min(10,'Heslo musí mít alespoň 10 znaků.').max(128)});
const registration=credentials.extend({...personalInput.shape,accountType:accountTypeInput}).strict().refine(d=>d.accountType==='CUSTOMER'||!!d.phone,{message:'Vyplňte telefon.',path:['phone']});
export async function POST(request:Request,{params}:{params:Promise<{action:string}>}) {
  try {
    requireSameOrigin(request);
    const {action}=await params;
    if(action==='logout'){await endSession();return json({ok:true});}
    if(action!=='register'&&action!=='login')return json({error:'Nenalezeno.'},404);
    const raw=await readJson(request,8192);
    const credentialsData=credentials.parse(raw);
    limitAuth(action,credentialsData.email);
    if(action==='login') {
      const d=credentials.strict().parse(raw);
      const user=query('SELECT id,password_hash FROM users WHERE email=?',d.email).get<{id:string;password_hash:string}>();
      if(!await verifyPassword(d.password,user?.password_hash)||!user)return json({error:'Nesprávný e-mail nebo heslo.'},401);
      await startSession(user.id,request);
    } else {
      const d=registration.parse(raw),hashed=await passwordHash(d.password);
      const id=crypto.randomUUID(),now=new Date().toISOString(),name=d.firstName+' '+d.lastName;
      transaction(()=>{
        if(query('SELECT id FROM users WHERE email=?',d.email).get())throw new HttpError(409,'Účet s tímto e-mailem už existuje. Přihlaste se.');
        query('INSERT INTO users(id,email,password_hash,created_at,first_name,last_name,phone) VALUES(?,?,?,?,?,?,?)',id,d.email,hashed,now,d.firstName,d.lastName,d.phone).run();
        query('INSERT INTO profiles(id,name,workspace,created_at) VALUES(?,?,?,?)',id,name,name,now).run();
        const accountId=createAccount(id,d.accountType,name);
        query('UPDATE users SET last_account_id=? WHERE id=?',accountId,id).run();
      });
      await startSession(id,request);
    }
    const user=await getUser();
    if(!user)throw new HttpError(503,'Relaci se nepodařilo vytvořit.');
    return json({ok:true,redirectTo:destination(getContext(user))});
  } catch(error) {
    if(error instanceof z.ZodError)return json({error:error.issues[0]?.message??'Zkontrolujte údaje.'},400);
    if(error instanceof HttpError)return json({error:error.message},error.status);
    console.error('Authentication failed',error instanceof Error?error.name:'unknown');
    return json({error:'Přihlášení není momentálně dostupné. Zkuste to znovu.'},503);
  }
}
