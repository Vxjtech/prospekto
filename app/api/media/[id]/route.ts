import {query} from '@/db';
import {getUser} from '@/lib/auth';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  const image=query('SELECT m.account_id,m.mime_type,m.contents,a.completed_at FROM media_assets m JOIN accounts a ON a.id=m.account_id WHERE m.id=?',id).get<{account_id:string;mime_type:string;contents:Uint8Array;completed_at:string|null}>();
  if(!image)return new Response(null,{status:404});
  // Only referenced profile images become public; discarded uploads remain private.
  const published=image.completed_at&&query('SELECT 1 FROM provider_profiles WHERE account_id=? AND (avatar_url=? OR cover_url=?) UNION ALL SELECT 1 FROM portfolio_items WHERE account_id=? AND image_url=?',image.account_id,'/api/media/'+id+'/','/api/media/'+id+'/',image.account_id,'/api/media/'+id+'/').get();
  if(!published){const user=await getUser();if(!user||!query('SELECT 1 FROM account_members WHERE account_id=? AND user_id=?',image.account_id,user.userId).get())return new Response(null,{status:404});}
  return new Response(new Uint8Array(image.contents),{headers:{'Content-Type':image.mime_type,'Content-Length':String(image.contents.length),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"}});
}
