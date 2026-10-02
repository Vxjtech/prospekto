import {redirect} from 'next/navigation';
import {query} from '@/db';
import {getUser} from '@/lib/auth';
import {getContext} from '@/lib/accounts/store';
import {destination} from '@/lib/accounts/model';
import {Logo} from '@/components/prospekto/logo';
import {LogoutButton} from '@/components/panel/logout-button';
import '@/app/panel/panel.css';
import '@/app/marketplace.css';
export const dynamic='force-dynamic';
export const metadata={title:'Administrace | Prospekto',robots:{index:false,follow:false}};
export default async function Page() {
  const user=await getUser();if(!user)redirect('/prihlaseni/');
  if(user.platformRole!=='PLATFORM_ADMIN')redirect(destination(getContext(user)));
  const rows=query('SELECT type,COUNT(*) AS count,COUNT(completed_at) AS completed FROM accounts GROUP BY type').all<{type:string|null;count:number;completed:number}>();
  return <main className="m-onboarding p-app"><header className="m-public-header"><Logo/><LogoutButton/></header><section className="m-wizard"><span className="m-eyebrow">PLATFORM ADMIN</span><h1>Administrace Prospekto</h1><p>Přehled účtů a dokončených registrací.</p><div className="m-card-grid">{rows.map(row=><article key={row.type??'pending'} className="p-card"><h2>{row.type??'Čeká na výběr typu'}</h2><p>{row.count} účtů · {row.completed} dokončených</p></article>)}</div></section></main>;
}
