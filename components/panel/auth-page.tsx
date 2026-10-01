import {HomeLink} from '@/components/prospekto/home-link';
import {redirect} from 'next/navigation';
import {getUser} from '@/lib/auth';
import {Logo} from '@/components/prospekto/logo';
import {AuthForm} from './auth-form';
import {Database, Mail, SlidersHorizontal, ShieldCheck} from 'lucide-react';
import '@/app/panel/panel.css';
export async function AuthPage({login = false}: {login?: boolean}) {
  if (await getUser()) redirect('/panel/');
  return <main className="p-auth">
    <section className="p-auth-story"><Logo plain/><div><h1>Vaše další<br/>příležitost začíná tady.</h1><p>Firmy, kontakty a vaše obchodní aktivity.<br/>V jednom přehledném prostoru.</p><ul>
      <li><Database size={21}/> Kontakty, které snadno najdete</li>
      <li><Mail size={21}/> Kampaně s osobním přístupem</li>
      <li><SlidersHorizontal size={21}/> Váš e-mail bot pod kontrolou</li>
    </ul></div><span className="p-auth-bottom">Méně hledání. Více příležitostí.</span></section>
    <section className="p-auth-content"><HomeLink className="p-back"/><div className="p-auth-card"><span className="p-round-icon"><ShieldCheck size={25}/></span><h2>{login ? 'Vítejte zpět.' : 'Vytvořte si účet.'}</h2><p>{login ? 'Přihlaste se a pokračujte ve svém pracovním prostoru.' : 'Začněte s Prospektem a mějte svůj obchod na jednom místě.'}</p><AuthForm login={login}/><p className="p-auth-switch">{login ? 'Ještě nemáte účet?' : 'Už máte účet?'} <a href={login ? '/registrace/' : '/prihlaseni/'}>{login ? 'Zaregistrovat se' : 'Přihlásit se'}</a></p></div><p className="p-auth-foot">© {new Date().getFullYear()} Prospekto</p></section>
  </main>;
}
