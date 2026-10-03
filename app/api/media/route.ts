import {query,transaction} from '@/db';
import {getUser} from '@/lib/auth';
import {requireManager} from '@/lib/accounts/store';
import {HttpError,json,requireSameOrigin} from '@/lib/http';
export const runtime='nodejs';
export async function POST(request:Request) {
  try {
    requireSameOrigin(request);const user=await getUser();if(!user)throw new HttpError(401,'Přihlaste se.');
    const account=requireManager(user);if(account.type==='CUSTOMER')throw new HttpError(403,'Fotografie patří k profilu dodavatele.');
    const type=request.headers.get('content-type');
    if(!['image/jpeg','image/png','image/webp'].includes(type??''))throw new HttpError(415,'Použijte JPG, PNG nebo WebP.');
    const reader=request.body?.getReader();if(!reader)throw new HttpError(400,'Chybí obrázek.');
    const chunks:Uint8Array[]=[];let size=0;
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2*1024*1024){await reader.cancel();throw new HttpError(413,'Obrázek může mít nejvýše 2 MB.');}chunks.push(value);}
    const bytes=Buffer.concat(chunks);
    const valid=type==='image/jpeg'?bytes.subarray(0,3).equals(Buffer.from([255,216,255])):type==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
    if(!valid)throw new HttpError(400,'Soubor není platný obrázek daného typu.');
    const id=crypto.randomUUID();
    transaction(()=>{
      if((query('SELECT COUNT(*) AS n FROM media_assets WHERE account_id=?',account.id).get<{n:number}>()?.n??0)>=60)throw new HttpError(409,'Dosáhli jste limitu 60 nahraných obrázků.');
      query('INSERT INTO media_assets(id,account_id,mime_type,contents,created_at) VALUES(?,?,?,?,?)',id,account.id,type!,bytes,new Date().toISOString()).run();
    });
    return json({url:'/api/media/'+id+'/'});
  }catch(error){if(error instanceof HttpError)return json({error:error.message},error.status);return json({error:'Obrázek se nepodařilo uložit.'},503);}
}
