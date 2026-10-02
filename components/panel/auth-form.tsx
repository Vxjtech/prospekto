'use client';
import {useState, type FormEvent} from 'react';
import {Field, PanelButton} from './ui';

export function AuthForm({login = false}: {login?: boolean}) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form.entries());
    try {
      const response = await fetch(`/api/auth/${login ? 'login' : 'register'}/`, {method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(values)});
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Údaje se nepodařilo odeslat.');
      window.location.assign('/panel/');
    } catch (error) { setError(error instanceof Error ? error.message : 'Zkuste to znovu.'); setBusy(false); }
  }
  return <form onSubmit={submit} className="p-form">
    {!login && <><Field label="Vaše jméno"><input name="name" autoComplete="name" minLength={2} maxLength={80} required/></Field><Field label="Pracovní prostor"><input name="workspace" autoComplete="organization" placeholder="Moje firma" minLength={2} maxLength={80} required/></Field></>}
    <Field label="E-mail"><input name="email" type="email" autoComplete="username" maxLength={254} required/></Field>
    <Field label="Heslo" hint={login ? undefined : 'Alespoň 10 znaků.'}><input name="password" type="password" autoComplete={login ? 'current-password' : 'new-password'} minLength={10} maxLength={128} required/></Field>
    {error && <p className="p-error" role="alert">{error}</p>}
    <PanelButton type="submit" disabled={busy}>{busy ? 'Chvilku prosím…' : login ? 'Přihlásit se' : 'Vytvořit účet'}</PanelButton>
    {!login && <p className="p-muted">Firemní kontakty, seznamy a nastavení budou dostupné ve vašem účtu.</p>}
  </form>;
}
