import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
export const metadata={title:'Správa pracovních nabídek | Prospekto',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{saved?:string}>}){const {saved}=await searchParams;redirect('/dodavatel/nabor/'+(saved==='1'?'?saved=1':''));}
