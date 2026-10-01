/* eslint-disable @next/next/no-html-link-for-pages -- Account links retain native navigation before hydration. */
import {Button} from '@/components/ui/button';

export function HeaderAccountActions(){
 return <nav className="header-account-actions" aria-label="Uživatelský účet">
  <a href="/prihlaseni/">Přihlásit se</a>
  <Button asChild className="action action-dark"><a href="/registrace/">Vytvořit účet</a></Button>
 </nav>;
}
