'use client';
import {useState, type ReactNode} from 'react';
export function LogoutButton({className, children}: {className?: string; children?: ReactNode}) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  return <><button type="button" className={className} disabled={busy} onClick={async () => {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth/logout/', {method: 'POST', credentials: 'same-origin'});
      if (!response.ok) throw new Error('Odhlášení se nezdařilo. Zkuste to znovu.');
      window.location.assign('/');
    } catch (error) { setError(error instanceof Error ? error.message : 'Zkuste to znovu.'); setBusy(false); }
  }}>{busy ? 'Odhlašuji…' : children || 'Odhlásit se'}</button>{error && <p className="p-error" role="alert">{error}</p>}</>;
}
