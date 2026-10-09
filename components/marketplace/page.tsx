import {redirect,notFound} from 'next/navigation';
import {query} from '@/db';
import {getUser} from '@/lib/auth';
import {catalog,getContext,onboardingData,requireAccount} from '@/lib/accounts/store';
import {canManage,destination,type AccountType} from '@/lib/accounts/model';
import {marketState} from '@/lib/marketplace/store';
import {Dashboard} from './dashboard';
import {employerJobs,applications} from '@/lib/jobs/store';
import '@/app/panel/panel.css';
import '@/app/marketplace.css';
export async function AccountPage({type,section,saved=false}:{type:AccountType;section:string[];saved?:boolean}) {
  const user=await getUser();if(!user)redirect('/prihlaseni/');
  const context=getContext(user),account=context.account;
  if(context.platformAdmin||!account?.completedAt||account.type!==type)redirect(destination(context));
  requireAccount(user);
  const view=section[0]??'prehled';
  if(type!=='CUSTOMER'&&view==='leady'&&section.length===1)redirect(destination(context)+'nabidky/');
  if(type!=='CUSTOMER'&&view==='prijate-nabidky'&&section.length===1)redirect(destination(context)+'moje-poptavky/');
  if(type!=='CUSTOMER'&&view==='statistiky'&&section.length===1)redirect(destination(context));
  if(view==='recenze'&&section.length===1)redirect(destination(context)+'zpravy/');
  const allowed=type==='CUSTOMER'?['prehled','poptavky','nova-poptavka','nabidky','zpravy','dodavatele','oblibeni','nastaveni']:['prehled','poptavky','moje-poptavky','nova-poptavka','dodavatele','oblibeni','leady','zpravy','zakazky','kalendar','profil','nastaveni','nabidky','nabor'];
  if(section.length>1||!allowed.includes(view))notFound();
  if(view==='nabor'&&!canManage(account.role))notFound();
  const team=type==='COMPANY'&&canManage(account.role)?query('SELECT p.name,u.email,m.role FROM account_members m JOIN users u ON u.id=m.user_id LEFT JOIN profiles p ON p.id=u.id WHERE m.account_id=? ORDER BY m.created_at',account.id).all<{name:string;email:string;role:string}>():[];
  return <Dashboard key={account.id+view} context={context} initial={marketState(user)} view={view} name={user.fullName??user.email} email={user.email} services={catalog()} profile={type==='CUSTOMER'?null:onboardingData(user,account)} team={team} jobs={view==='nabor'?employerJobs(user):[]} applications={view==='nabor'?applications(user):[]} saved={saved}/>;
}
