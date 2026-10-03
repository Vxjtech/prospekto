'use client';
import {useState} from 'react';
import Link from 'next/link';
import {type AccountContext,typeLabels} from '@/lib/accounts/model';
export function AccountSwitcher({context}:{context:AccountContext}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function change(id:string) {
    setBusy(true);setError('');
    try {
      const response=await fetch('/api/accounts/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'switch',accountId:id})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error);
      window.location.assign(data.redirectTo);
    }catch(error){setError(error instanceof Error?error.message:'Přepnutí se nepodařilo.');setBusy(false);}
  }
  return <div className="m-switcher"><label><span>Aktivní prostředí</span><select aria-label="Přepnout účet" value={context.account?.id??''} onChange={e=>void change(e.target.value)} disabled={busy}>{!context.account&&<option value="">Vyberte účet</option>}{context.accounts.map(a=><option key={a.id} value={a.id}>{a.name} · {a.type?typeLabels[a.type]:'Dokončit nastavení'}</option>)}</select></label><Link href="/onboarding/?new=1">+ Přidat prostředí</Link>{error&&<span role="alert" className="p-error">{error}</span>}</div>;
}
