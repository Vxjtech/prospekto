'use client';
import {useState,type FormEvent} from 'react';
import {Field,PanelButton} from './ui';
import {TypePicker} from '@/components/accounts/type-picker';
import {type AccountType,typeLabels} from '@/lib/accounts/model';

export function AuthForm({login=false}:{login?:boolean}) {
  const [type,setType]=useState<AccountType|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setError('');
    const values=Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const response=await fetch('/api/auth/'+(login?'login':'register')+'/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...values,...(!login?{accountType:type}:{})})});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||'Údaje se nepodařilo odeslat.');
      window.location.assign(result.redirectTo);
    } catch(error){setError(error instanceof Error?error.message:'Zkuste to znovu.');setBusy(false);}
  }
  if(!login&&!type)return <TypePicker onChoose={setType}/>;
  return <div className={!login?'m-registration-form':''}>{!login&&<><button className="m-text-button" onClick={()=>setType(null)}>← Změnit typ účtu</button><span className="m-eyebrow">{typeLabels[type!]}</span><h1>{type==='CUSTOMER'?'Vytvořte si osobní účet.':'Začněme vašimi údaji.'}</h1><p>{type==='CUSTOMER'?'Stačí pár údajů a můžete zadat první poptávku.':type==='COMPANY'?'Stanete se vlastníkem firemního účtu. Poté nastavíme vaši firmu.':'Krok 1 z 5 · Osobní údaje'}</p></>}
    <form onSubmit={submit} className="p-form">
      {!login&&<div className="m-form-grid"><Field label="Jméno"><input name="firstName" autoComplete="given-name" maxLength={80} required/></Field><Field label="Příjmení"><input name="lastName" autoComplete="family-name" maxLength={80} required/></Field></div>}
      <Field label={type==='COMPANY'?'Pracovní e-mail':'E-mail'}><input name="email" type="email" autoComplete="username" maxLength={254} required/></Field>
      {!login&&<Field label={type==='CUSTOMER'?'Telefon (volitelně)':'Telefon'}><input name="phone" type="tel" autoComplete="tel" maxLength={30} required={type!=='CUSTOMER'}/></Field>}
      <Field label="Heslo" hint={login?undefined:'Alespoň 10 znaků.'}><input name="password" type="password" autoComplete={login?'current-password':'new-password'} minLength={10} maxLength={128} required/></Field>
      {error&&<p className="p-error" role="alert">{error}</p>}
      <PanelButton type="submit" disabled={busy}>{busy?'Chvilku prosím…':login?'Přihlásit se':type==='CUSTOMER'?'Vytvořit účet':'Vytvořit účet a pokračovat'}</PanelButton>
    </form>
  </div>;
}
