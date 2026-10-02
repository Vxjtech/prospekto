import {redirect} from 'next/navigation';
import Link from 'next/link';
import {getUser} from '@/lib/auth';
import {getContext} from '@/lib/accounts/store';
import {destination} from '@/lib/accounts/model';
import {Logo} from '@/components/prospekto/logo';
import {AuthForm} from './auth-form';
import '@/app/panel/panel.css';
import '@/app/marketplace.css';
export async function AuthPage({login=false}:{login?:boolean}) {
  const user=await getUser();
  if(user)redirect(destination(getContext(user)));
  if(!login)return <main className="m-onboarding p-app"><header className="m-public-header"><Logo/><Link href="/prihlaseni/">Už máte účet? <strong>Přihlásit se →</strong></Link></header><AuthForm/><footer className="m-footer">© {new Date().getFullYear()} Prospekto · Méně hledání. Více příležitostí.</footer></main>;
  return <main className="p-auth"><section className="p-auth-story"><Logo plain/><div><h1>Vaše další<br/>příležitost začíná tady.</h1><p>Správní lidé. Nové zakázky.<br/>Vše na jednom místě.</p></div><span className="p-auth-bottom">Méně hledání. Více příležitostí.</span></section><section className="p-auth-content"><Link href="/" className="p-back">← Zpět na úvod</Link><div className="p-auth-card"><h2>Vítejte zpět.</h2><p>Přihlaste se do svého Prospekta.</p><AuthForm login/><p className="p-auth-switch">Ještě nemáte účet? <Link href="/registrace/">Zaregistrovat se</Link></p></div></section></main>;
}
