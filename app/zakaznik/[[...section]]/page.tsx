import {AccountPage} from '@/components/marketplace/page';
export const dynamic='force-dynamic';
export const metadata={title:'Moje Prospekto | Prospekto',robots:{index:false,follow:false}};
export default async function Page({params,searchParams}:{params:Promise<{section?:string[]}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){const [{section=[]},filters]=await Promise.all([params,searchParams]);return <AccountPage type="CUSTOMER" section={section} searchParams={filters}/>;}
