'use client';
import {useState,type FormEvent} from 'react';
import {Field,PanelButton} from '@/components/panel/ui';
export function JobApply({jobId,name}:{jobId:string;name:string}) {
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(false);
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setError('');
  const data=Object.fromEntries(new FormData(e.currentTarget));
  try{const response=await fetch('/api/jobs/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'apply',data:{jobId,...data}})});const result=await response.json();if(!response.ok)throw new Error(result.error);setDone(true);}catch(error){setError((error as Error).message);}finally{setBusy(false);}
 }
 if(done)return <div className="m-success" role="status">Vaše reakce je uložená a zaměstnavatel ji vidí v Prospektu. Najdete ji také v „Moje reakce“.</div>;
 return <form className="p-form" onSubmit={submit}><h2>Reagovat na pozici</h2><p>Kontaktní údaje a zprávu předáme pouze zaměstnavateli této nabídky. Použijeme e-mail vašeho přihlášeného účtu.</p><Field label="Jméno a příjmení"><input name="name" defaultValue={name} minLength={2} maxLength={160} required/></Field><Field label="Telefon (volitelně)"><input name="phone" type="tel" maxLength={30}/></Field><Field label="Krátké představení"><textarea name="message" minLength={10} maxLength={6000} rows={5} required/></Field><Field label="Odkaz na životopis (volitelně)" hint="HTTPS odkaz na dokument, ke kterému má zaměstnavatel přístup."><input name="resumeUrl" type="url" maxLength={2048} placeholder="https://"/></Field>{error&&<p role="alert" className="p-error">{error}</p>}<PanelButton type="submit" disabled={busy}>{busy?'Odesílám…':'Odeslat reakci zaměstnavateli'}</PanelButton></form>;
}
