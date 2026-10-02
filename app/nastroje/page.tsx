import {HomeLink} from '@/components/prospekto/home-link';
import {redirect} from 'next/navigation';
import {getUser} from '@/lib/auth';
import {getProfile,getPanelState} from '@/lib/panel/store';
import {getPrivateCompanies} from '@/lib/companies';
import {Panel} from '@/components/panel/panel';
import '@/app/panel/panel.css';
import '@/app/marketplace.css';
import {getContext,requireAccount} from '@/lib/accounts/store';
import {destination} from '@/lib/accounts/model';
import Link from 'next/link';
export const dynamic='force-dynamic';
export const metadata={title:'Pracovní prostor | Prospekto',robots:{index:false,follow:false}};
export default async function PanelPage(){
 const user=await getUser();if(!user)redirect('/registrace/');
 const ctx=getContext(user);if(!ctx.account?.completedAt||ctx.account.type==='CUSTOMER')redirect(destination(ctx));requireAccount(user,'provider');
 let profile;try{profile=await getProfile(user);}catch{return <Unavailable/>;}
 if(!profile)redirect('/registrace/');
 let state,database;try{[state,database]=await Promise.all([getPanelState(user,profile),getPrivateCompanies({query:'',category:'',region:'',page:1,pageSize:20})]);}catch{return <Unavailable/>;}
 return <><Link className="m-tools-back" href={destination(ctx)}>← Zpět do přehledu účtu</Link><Panel initial={state} initialDatabase={database}/></>;
}
function Unavailable(){return <main className="p-unavailable"><h1>Pracovní prostor se nepodařilo načíst.</h1><p>Vaše data zůstávají uložená. Zkuste stránku načíst znovu.</p><a className="p-button" href="/nastroje/">Zkusit znovu</a><HomeLink/></main>;}
