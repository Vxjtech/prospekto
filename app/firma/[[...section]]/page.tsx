import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
// Preserve bookmarks, including the selected messenger conversation.
export default async function Page({params,searchParams}:{params:Promise<{section?:string[]}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const {section=[]}=await params;
  const query=new URLSearchParams();
  for(const [key,value] of Object.entries(await searchParams))for(const item of Array.isArray(value)?value:value===undefined?[]:[value])query.append(key,item);
  const path=section.length===1&&section[0]==='leady'?['nabidky']:section;
  redirect('/dodavatel/'+(path.length?path.map(encodeURIComponent).join('/')+'/':'')+(query.size?'?'+query.toString():''));
}
