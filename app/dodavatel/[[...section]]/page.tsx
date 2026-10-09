import {AccountPage} from '@/components/marketplace/page';
export const dynamic='force-dynamic';
export const metadata={title:'Přehled dodavatele | Prospekto',robots:{index:false,follow:false}};
export default async function Page({params,searchParams}:{params:Promise<{section?:string[]}>;searchParams:Promise<{saved?:string}>}){const {section=[]}=await params,query=await searchParams;return <AccountPage type="COMPANY" section={section} saved={query.saved==='1'}/>;}
