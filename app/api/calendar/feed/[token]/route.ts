import {query} from '@/db';
import {json} from '@/lib/http';
export const dynamic='force-dynamic';

type FeedTask={id:string;title:string;dueAt:string;done:number};
function escapeIcs(value:string){
 return value.replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
}
function foldIcsLine(line:string){
 const result:string[]=[];let current='',bytes=0;
 for(const character of line){
  const size=new TextEncoder().encode(character).length;
  if(bytes+size>75){result.push(current);current=' '+character;bytes=1+size;}
  else{current+=character;bytes+=size;}
 }
 result.push(current);return result.join('\r\n');
}
function utcStamp(value:string){
 return new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
}
export async function GET(_request:Request,{params}:{params:Promise<{token:string}>}){
 const {token}=await params;
 if(!/^[A-Za-z0-9_-]{43}$/.test(token))return json({error:'Kalendář nebyl nalezen.'},404);
 const subscription=query('SELECT account_id AS accountId FROM calendar_subscriptions WHERE token=?',token).get<{accountId:string}>();
 if(!subscription)return json({error:'Kalendář nebyl nalezen.'},404);
 const tasks=query('SELECT id,title,due_at AS dueAt,done FROM tasks WHERE account_id=? AND due_at IS NOT NULL ORDER BY due_at,id',subscription.accountId).all<FeedTask>();
 const stamp=utcStamp(new Date().toISOString()),lines=[
  'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Prospekto//Kalendář//CS',
  'CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:Prospekto',
  'X-PUBLISHED-TTL:PT15M','REFRESH-INTERVAL;VALUE=DURATION:PT15M',
 ];
 for(const task of tasks){
  const start=utcStamp(task.dueAt),end=utcStamp(new Date(new Date(task.dueAt).getTime()+30*60*1000).toISOString());
  lines.push('BEGIN:VEVENT',`UID:${task.id}@prospekto`,`DTSTAMP:${stamp}`,`DTSTART:${start}`,`DTEND:${end}`,`SUMMARY:${escapeIcs(task.title)}`,`X-PROSPEKTO-COMPLETED:${task.done?'TRUE':'FALSE'}`,'STATUS:CONFIRMED','END:VEVENT');
 }
 lines.push('END:VCALENDAR');
 return new Response(lines.map(foldIcsLine).join('\r\n')+'\r\n',{headers:{
  'Content-Type':'text/calendar; charset=utf-8',
  'Cache-Control':'private, no-cache, no-store, must-revalidate',
  'Referrer-Policy':'no-referrer',
  'X-Content-Type-Options':'nosniff',
 }});
}
