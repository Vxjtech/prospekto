import {redirect} from 'next/navigation';
import {getUser} from '@/lib/auth';
import {getContext} from '@/lib/accounts/store';
import {destination} from '@/lib/accounts/model';
export const dynamic='force-dynamic';
export default async function PanelEntry() {
  const user=await getUser();
  if(!user)redirect('/prihlaseni/');
  redirect(destination(getContext(user)));
}
