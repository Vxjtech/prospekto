import {AccountPage} from '@/components/marketplace/page';
export const dynamic='force-dynamic';
export const metadata={title:'Moje Prospekto | Prospekto',robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{section?:string[]}>}){const {section=[]}=await params;return <AccountPage type="CUSTOMER" section={section}/>;}
