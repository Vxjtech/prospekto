import Link from 'next/link';

export function WorkspaceTabs({active}:{active:'people'|'companies'}){
 return <nav className="workspace-tabs" aria-label="Pracovní prostředí">
  <Link href="/dodavatel/" className={active==='people'?'active':''} aria-current={active==='people'?'page':undefined}>Lidé</Link>
  <Link href="/nastroje/" className={active==='companies'?'active':''} aria-current={active==='companies'?'page':undefined}>Firmy</Link>
 </nav>;
}
