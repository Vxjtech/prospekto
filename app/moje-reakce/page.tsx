import {redirect} from 'next/navigation';
import Link from 'next/link';
import {getUser} from '@/lib/auth';
import {getContext} from '@/lib/accounts/store';
import {destination} from '@/lib/accounts/model';
import {applications} from '@/lib/jobs/store';
import {Logo} from '@/components/prospekto/logo';
import '@/app/panel/panel.css';
import '@/app/marketplace.css';
import '@/app/prace/jobs.css';
export const dynamic='force-dynamic';
export const metadata={title:'Moje reakce na práci | Prospekto',robots:{index:false,follow:false}};
export default async function Page(){
 const user=await getUser();if(!user)redirect('/prihlaseni/');
 const context=getContext(user);if(context.account?.type!=='CUSTOMER'||!context.account.completedAt)redirect(destination(context));
 const items=applications(user);
 return <main className="m-onboarding p-app"><header className="m-public-header"><Logo/><Link href="/zakaznik/">Můj účet →</Link></header><section className="j-public"><div className="p-heading m-section"><div><h1>Moje reakce na pracovní nabídky</h1><p>Přehled odpovědí odeslaných přímo přes Prospekto.</p></div><Link className="p-button" href="/prace/">Najít práci</Link></div><div className="m-records">{items.map(a=><article className="p-card" key={a.id}><h2>{a.jobTitle}</h2><p>{a.companyName} · Odesláno {new Date(a.createdAt).toLocaleDateString('cs-CZ')}</p><p className="m-prewrap">{a.message}</p></article>)}</div>{!items.length&&<div className="p-empty"><h2>Zatím jste na žádnou pozici nereagovali.</h2><p>Najděte si nabídku a pošlete zaměstnavateli své představení.</p><Link className="p-button" href="/prace/">Prohlédnout pracovní nabídky</Link></div>}</section></main>;
}
