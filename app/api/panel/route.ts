import {getUser} from '@/lib/auth';
import {requireSameOrigin, HttpError} from '@/lib/http';
import { actionInput } from '@/lib/panel/model';
import { applyAction, getPanelState, getProfile, PanelError } from '@/lib/panel/store';
export const dynamic='force-dynamic';
function json(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});}
function failure(error:unknown){if(error instanceof PanelError || error instanceof HttpError)return json({error:error.message},error.status);console.error('Panel storage operation failed',error instanceof Error?error.name:'unknown');return json({error:'Uložení není momentálně dostupné. Vaše rozepsaná data zůstala ve formuláři. Zkuste to znovu.'},503);}
export async function GET(){try{const user=await getUser();if(!user)return json({error:'Přihlaste se pro přístup do panelu.'},401);const profile=await getProfile(user);if(!profile)return json({error:'Dokončete registraci.'},403);return json({state:await getPanelState(user,profile)});}catch(e){return failure(e);}}
export async function POST(request:Request){
 try{
 const user=await getUser();if(!user)return json({error:'Vaše přihlášení vypršelo. Přihlaste se znovu.'},401);
 requireSameOrigin(request);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'Neplatný formát požadavku.'},415);
 if(Number(request.headers.get('content-length')??0)>65536)return json({error:'Požadavek je příliš velký.'},413);
 const reader=request.body?.getReader();if(!reader)return json({error:'Chybí data.'},400);const chunks:Uint8Array[]=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536){await reader.cancel();return json({error:'Požadavek je příliš velký.'},413);}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}let raw;try{raw=JSON.parse(new TextDecoder().decode(bytes));}catch{return json({error:'Neplatná data.'},400);}
 const parsed=actionInput.safeParse(raw);if(!parsed.success)return json({error:'Zkontrolujte vyplněná pole. '+parsed.error.issues[0]?.message},400);
 await applyAction(user,parsed.data);const profile=await getProfile(user);if(!profile)throw new Error('Missing profile');return json({state:await getPanelState(user,profile)});
 }catch(e){return failure(e);}
}
