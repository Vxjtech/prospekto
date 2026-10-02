import {AccountPage} from '@/components/marketplace/page';
export const dynamic='force-dynamic';
export const metadata={title:'Firemní přehled | Prospekto',robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{section?:string[]}>}){const {section=[]}=await params;return <AccountPage type="COMPANY" section={section}/>;}
