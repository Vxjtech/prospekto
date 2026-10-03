import {redirect} from 'next/navigation';
import Link from 'next/link';
import {getUser} from '@/lib/auth';
import {getContext,requireManager} from '@/lib/accounts/store';
import {destination,canManage} from '@/lib/accounts/model';
import {employerJobs,applications} from '@/lib/jobs/store';
import {Logo} from '@/components/prospekto/logo';
import {AccountSwitcher} from '@/components/accounts/account-switcher';
import {JobManager} from '@/components/jobs/manager';
import '@/app/panel/panel.css';
import '@/app/marketplace.css';
import '@/app/prace/jobs.css';
export const dynamic='force-dynamic';
export const metadata={title:'Správa pracovních nabídek | Prospekto',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{saved?:string}>}){
 const user=await getUser();if(!user)redirect('/prihlaseni/');
 const context=getContext(user),a=context.account;
 if(!a?.completedAt||a.type==='CUSTOMER'||!canManage(a.role))redirect(destination(context));
 requireManager(user,true);
 return <main className="m-onboarding p-app"><header className="m-public-header"><Logo/><AccountSwitcher context={context}/></header><section className="j-public"><Link className="m-text-button" href={destination(context)}>← Zpět do přehledu účtu</Link><div className="m-section"><JobManager jobs={employerJobs(user)} applications={applications(user)} companyName={a.name} contactName={user.fullName??''} email={user.email} saved={(await searchParams).saved==='1'}/></div></section></main>;
}
