import {redirect} from 'next/navigation';
import Link from 'next/link';
import {getUser} from '@/lib/auth';
import {getContext,catalog,onboardingData} from '@/lib/accounts/store';
import {destination} from '@/lib/accounts/model';
import {Logo} from '@/components/prospekto/logo';
import {LogoutButton} from '@/components/panel/logout-button';
import {Onboarding} from '@/components/accounts/onboarding';
import '@/app/panel/panel.css';
import '@/app/marketplace.css';
export const dynamic='force-dynamic';
export const metadata={title:'Nastavení účtu | Prospekto',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{new?:string;edit?:string;step?:string}>}) {
  const user=await getUser();if(!user)redirect('/prihlaseni/');
  const params=await searchParams,context=getContext(user),fresh=params.new==='1',edit=params.edit==='1';
  if(context.account?.completedAt&&!fresh&&!edit)redirect(destination(context));
  return <main className="m-onboarding p-app"><header className="m-public-header"><Logo/><div>{context.account?.completedAt&&<Link href={destination(context)}>Zpět do přehledu</Link>}<LogoutButton/></div></header><Onboarding context={context} fresh={fresh} edit={edit} initialStep={Number(params.step)||undefined} data={context.account&&!fresh?onboardingData(user,context.account):null} services={catalog()}/></main>;
}
