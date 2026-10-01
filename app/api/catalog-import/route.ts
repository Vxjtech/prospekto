import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {timingSafeEqual} from 'node:crypto';
import {catalogDb} from '@/lib/companies';
import {COMPANY_CATEGORIES,normalizeSearch} from '@/lib/company-types';
export const dynamic='force-dynamic';
const IMPORT_ID='kontakty-2026-10-01',EXPECTED=245828,EXPECTED_CATEGORIES=282456;
const stringList=z.array(z.string().max(4096)).max(100);
const rowSchema=z.object({id:z.string().regex(/^zf:\d{1,12}$/),name:z.string().min(1).max(300),ico:z.string().max(20),phones:stringList,emails:stringList,websites:stringList,categories:z.array(z.string().refine(id=>COMPANY_CATEGORIES.some(c=>c.id===id))).min(1).max(12),sourceUrl:z.string().max(2048),fetchedAt:z.string().max(100)}).strict();
const inputSchema=z.discriminatedUnion('action',[z.object({action:z.literal('batch'),chunk:z.number().int().min(0).max(245),hash:z.string().regex(/^[a-f0-9]{64}$/),rows:z.array(rowSchema).min(1).max(1000)}).strict(),z.object({action:z.literal('finish')}).strict()]);
function json(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex','X-Content-Type-Options':'nosniff'}});}
function authorized(request:Request){const key=env.CATALOG_IMPORT_TOKEN;if(!key)return false;const sent=request.headers.get('authorization')??'',expected='Bearer '+key;return sent.length===expected.length&&timingSafeEqual(Buffer.from(sent),Buffer.from(expected));}
export async function GET(request:Request){if(!authorized(request))return json({error:'Not found'},404);const db=catalogDb();return json({meta:await db.prepare('SELECT * FROM catalog_meta WHERE id=?').bind(IMPORT_ID).first(),chunks:(await db.prepare('SELECT id,hash,rows FROM catalog_chunks ORDER BY id').all()).results});}
export async function POST(request:Request){
 if(!authorized(request))return json({error:'Not found'},404);
 try{
 const db=catalogDb();const active=await db.prepare('SELECT ready FROM catalog_meta WHERE id=?').bind(IMPORT_ID).first<{ready:number}>();if(active?.ready)return json({error:'Import already complete'},409);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON required'},415);
 const reader=request.body?.getReader();if(!reader)return json({error:'Missing body'},400);const chunks:Uint8Array[]=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2_000_000){await reader.cancel();return json({error:'Body too large'},413);}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 const parsed=inputSchema.safeParse(JSON.parse(new TextDecoder().decode(bytes)));if(!parsed.success)return json({error:'Invalid import payload'},400);const data=parsed.data;
 if(data.action==='finish'){
  const counts=await db.prepare("SELECT count(*) AS total,coalesce(sum(emails!='[]'),0) AS with_email,coalesce(sum(region!=''),0) AS regions FROM catalog_companies").first<{total:number;with_email:number;regions:number}>();
  const categories=await db.prepare('SELECT count(*) AS total FROM catalog_categories').first<{total:number}>();const completed=await db.prepare('SELECT count(*) AS chunks,sum(rows) AS total FROM catalog_chunks').first<{chunks:number;total:number}>();
  if(counts?.total!==EXPECTED||categories?.total!==EXPECTED_CATEGORIES||completed?.chunks!==246||completed.total!==EXPECTED)return json({error:'Import incomplete',counts,categories,completed},409);
  await db.prepare('UPDATE catalog_meta SET ready=1,total=?,with_email=?,regions_available=?,imported_at=? WHERE id=?').bind(counts.total,counts.with_email,counts.regions?1:0,new Date().toISOString(),IMPORT_ID).run();
  return json({ready:true,total:counts.total,withEmail:counts.with_email,categories:categories.total});
 }
 const existing=await db.prepare('SELECT hash FROM catalog_chunks WHERE id=?').bind(data.chunk).first<{hash:string}>();if(existing)return existing.hash===data.hash?json({chunk:data.chunk,alreadyImported:true}):json({error:'Chunk conflict'},409);
 const statements:D1PreparedStatement[]=[db.prepare('INSERT INTO catalog_meta (id) VALUES (?) ON CONFLICT DO NOTHING').bind(IMPORT_ID)];
 for(let i=0;i<data.rows.length;i+=8){const group=data.rows.slice(i,i+8),values=group.flatMap(r=>[r.id,r.name,normalizeSearch(r.name),r.ico,JSON.stringify(r.phones),JSON.stringify(r.emails),JSON.stringify(r.websites),JSON.stringify([...new Set(r.categories)]),'','',r.sourceUrl,r.fetchedAt]);statements.push(db.prepare('INSERT INTO catalog_companies (id,name,sort_name,ico,phones,emails,websites,categories,city,region,source_url,fetched_at) VALUES '+group.map(()=>'(?,?,?,?,?,?,?,?,?,?,?,?)').join(',')+' ON CONFLICT DO NOTHING').bind(...values));}
 const categories=data.rows.flatMap(r=>[...new Set(r.categories)].map(c=>[r.id,c]));for(let i=0;i<categories.length;i+=45){const group=categories.slice(i,i+45);statements.push(db.prepare('INSERT INTO catalog_categories (company_id,category) VALUES '+group.map(()=>'(?,?)').join(',')+' ON CONFLICT DO NOTHING').bind(...group.flat()));}
 statements.push(db.prepare('INSERT INTO catalog_chunks (id,hash,rows) VALUES (?,?,?)').bind(data.chunk,data.hash,data.rows.length));await db.batch(statements);
 return json({chunk:data.chunk,imported:data.rows.length});
 }catch(error){console.error('Catalog import failed',error instanceof Error?error.message:'unknown');return json({error:'Import failed; safe to retry the same chunk'},503);}
}
