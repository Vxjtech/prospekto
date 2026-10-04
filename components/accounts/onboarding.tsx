'use client';
import {useState,type FormEvent} from 'react';
import Link from 'next/link';
import {TypePicker} from './type-picker';
import {Field,PanelButton} from '@/components/panel/ui';
import {CZECH_REGIONS} from '@/lib/company-types';
import {canManage,destination,typeLabels,type AccountContext,type AccountType,type OnboardingData,type Service} from '@/lib/accounts/model';

async function post(body:unknown) {
  const response=await fetch('/api/accounts/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||'Uložení se nepodařilo.');
  return result;
}
function MediaField({label,value,onChange,onError}:{label:string;value:string;onChange:(value:string)=>void;onError:(message:string)=>void}) {
  const [busy,setBusy]=useState(false);
  async function upload(file?:File) {
    if(!file)return;
    if(file.size>2*1024*1024){onError('Obrázek může mít nejvýše 2 MB.');return;}
    setBusy(true);
    try {
      const response=await fetch('/api/media/',{method:'POST',headers:{'Content-Type':file.type},body:file});
      const data=await response.json();if(!response.ok)throw new Error(data.error);
      onChange(data.url);
    }catch(error){onError(error instanceof Error?error.message:'Nahrání se nepodařilo.');}finally{setBusy(false);}
  }
  return <div className="m-media-field"><Field label={label} hint="JPG, PNG nebo WebP · nejvýše 2 MB"><input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>void upload(e.target.files?.[0])}/></Field>{busy&&<p role="status">Nahrávám…</p>}{value&&<div className="m-media-preview"><img src={value} alt={label}/><button type="button" className="m-text-button" onClick={()=>onChange('')}>Odebrat</button></div>}</div>;
}
export function Onboarding({context,fresh,edit,initialStep,data,services}:{context:AccountContext;fresh:boolean;edit:boolean;initialStep?:number;data:OnboardingData|null;services:Service[]}) {
  const account=context.account;
  const maxStep=account?.completedAt?5:account?.step??1;
  const [step,setStep]=useState(Math.max(1,Math.min(initialStep??maxStep,maxStep)));
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const [primary,setPrimary]=useState(data?.services.primaryServiceId??'');
  const [profile,setProfile]=useState(data?.profile??{avatarUrl:'',coverUrl:'',description:'',experience:'',website:'',socialLinks:[],portfolio:[],foundedYear:null,referencesText:''});
  async function choose(type:AccountType) {
    setBusy(true);setError('');
    try{const result=await post({action:'choose',type,newContext:fresh});window.location.assign(result.redirectTo);}catch(error){setError((error as Error).message);setBusy(false);}
  }
  if(fresh||!account?.type)return <><TypePicker onChoose={choose} busy={busy} legacy={!fresh&&!!account}/>{error&&<p role="alert" className="p-error m-centered">{error}</p>}</>;
  if(!canManage(account.role))return <section className="m-registration-form"><h1>Nastavení dokončí správce účtu.</h1><p>Po dokončení získáte přístup do podnikatelského prostředí. Obraťte se na vlastníka nebo administrátora účtu.</p></section>;
  if(!data)return null;
  const customer=account.type==='CUSTOMER',company=account.type==='COMPANY';
  const current=customer?1:step;
  const labels=['Osobní údaje','Údaje na IČO','Co děláte?','Kde pracujete?','Profil podnikání'];
  const split=(value:FormDataEntryValue|null)=>String(value??'').split(/[\n,]/).map(v=>v.trim()).filter(Boolean);
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setError('');
    const form=new FormData(event.currentTarget),values=Object.fromEntries(form);
    let payload:unknown=values;
    if(current===2)payload={...values,billingAddress:values.billingAddress||values.address};
    if(current===3)payload={primaryServiceId:primary,serviceIds:form.getAll('serviceIds'),specializations:split(form.get('specializations'))};
    if(current===4)payload={city:values.city,postalCode:values.postalCode,regions:form.getAll('regions'),cities:split(form.get('cities')),nationwide:form.has('nationwide'),maxDistanceKm:Number(values.maxDistanceKm)};
    if(current===5)payload={...profile,description:values.description,experience:values.experience,website:values.website,socialLinks:split(form.get('socialLinks')),foundedYear:values.foundedYear?Number(values.foundedYear):null,referencesText:values.referencesText??''};
    try {
      const result=await post({action:'step',step:current,data:payload});
      window.location.assign(edit?destination(context):result.redirectTo);
    }catch(error){setError((error as Error).message);setBusy(false);}
  }
  return <section className="m-wizard"><div className="m-intro"><span className="m-eyebrow">{typeLabels[account.type]}{!customer&&' · '+(edit?'Úprava profilu':'Krok '+current+' z 5')}</span><h1>{edit?'Upravte své Prospekto.':labels[current-1]}</h1><p>{customer?'Vaše údaje pro komunikaci s dodavateli.':'Každý dokončený krok uložíme. K nastavení se můžete kdykoliv vrátit.'}</p></div>
    {!customer&&<nav className="m-steps" aria-label="Kroky nastavení">{labels.map((label,index)=><button key={label} disabled={busy||index+1>maxStep} className={current===index+1?'active':''} aria-current={current===index+1?'step':undefined} onClick={()=>{setStep(index+1);setError('');}}><span>{index+1}</span>{label}</button>)}</nav>}
    <form className="p-form m-wizard-card" key={current} onSubmit={submit}>
      {current===1&&<><div className="m-form-grid"><Field label="Jméno"><input name="firstName" defaultValue={data.personal.firstName} autoComplete="given-name" maxLength={80} required/></Field><Field label="Příjmení"><input name="lastName" defaultValue={data.personal.lastName} autoComplete="family-name" maxLength={80} required/></Field></div><Field label={customer?'Telefon (volitelně)':'Telefon'}><input type="tel" name="phone" defaultValue={data.personal.phone} autoComplete="tel" maxLength={30} required={!customer}/></Field></>}
      {current===2&&<><div className="m-form-grid"><Field label="IČO" hint="Ověření v externí databázi bude dostupné později."><input name="ico" inputMode="numeric" pattern="[0-9]{8}" minLength={8} maxLength={8} defaultValue={data.business.ico} required/></Field>{company&&<Field label="DIČ (volitelně)"><input name="dic" defaultValue={data.business.dic} maxLength={20}/></Field>}</div><Field label={'Obchodní jméno / název'}><input name="businessName" defaultValue={data.business.businessName} autoComplete="organization" maxLength={160} required/></Field><Field label="Sídlo"><input name="address" defaultValue={data.business.address} autoComplete="street-address" maxLength={500} required/></Field><Field label="Fakturační adresa" hint="Pokud je stejná jako sídlo, nechte prázdné."><input name="billingAddress" defaultValue={data.business.billingAddress} maxLength={500}/></Field><Field label="Web (volitelně)"><input name="website" type="url" placeholder="https://" defaultValue={data.business.website} maxLength={2048}/></Field></>}
      {current===3&&<><Field label="Hlavní obor"><select value={primary} onChange={e=>setPrimary(e.target.value)} required><option value="">Vyberte hlavní obor</option>{services.filter(s=>!s.parentId).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field><fieldset className="m-services"><legend>Služby a podkategorie · můžete vybrat více</legend>{services.filter(s=>!s.parentId).map(category=><details key={category.id} open={primary===category.id||data.services.serviceIds.some(id=>services.some(s=>s.id===id&&s.parentId===category.id))}><summary>{category.name}</summary>{[category,...services.filter(s=>s.parentId===category.id)].map(s=><label className="m-checkbox" key={s.id}><input type="checkbox" name="serviceIds" value={s.id} defaultChecked={data.services.serviceIds.includes(s.id)}/>{s.parentId?s.name:'Vše v oboru '+s.name}</label>)}</details>)}</fieldset><Field label="Specializace (volitelně)" hint="Jednotlivé specializace oddělte čárkou."><input name="specializations" defaultValue={data.services.specializations.join(', ')} maxLength={2000} placeholder="Např. koupelny, historické budovy"/></Field></>}
      {current===4&&<><div className="m-form-grid"><Field label={company?'Výchozí lokalita':'Město'}><input name="city" defaultValue={data.area.city} maxLength={160} required placeholder="Ostrava"/></Field><Field label="PSČ (volitelně)"><input name="postalCode" defaultValue={data.area.postalCode} inputMode="numeric" maxLength={6}/></Field></div><Field label="Maximální dojezdová vzdálenost (km)"><input type="number" name="maxDistanceKm" min={0} max={1000} defaultValue={data.area.maxDistanceKm} required/></Field><Field label="Další města" hint="Oddělte čárkou."><input name="cities" defaultValue={data.area.cities.join(', ')} maxLength={8000}/></Field><fieldset className="m-services"><legend>Oblast působnosti</legend><label className="m-checkbox"><input name="nationwide" type="checkbox" defaultChecked={data.area.nationwide}/>Celá republika</label><div className="m-form-grid">{CZECH_REGIONS.map(r=><label className="m-checkbox" key={r.id}><input type="checkbox" name="regions" value={r.id} defaultChecked={data.area.regions.includes(r.id)}/>{r.label}</label>)}</div></fieldset><p>Například Ostrava + 40 km. Obor a vybrané lokality pomohou najít vhodné poptávky.</p></>}
      {current===5&&<><div className="m-form-grid"><MediaField label={'Profilová fotografie / logo'} value={profile.avatarUrl} onChange={avatarUrl=>setProfile(p=>({...p,avatarUrl}))} onError={setError}/>{company&&<MediaField label="Cover fotografie" value={profile.coverUrl} onChange={coverUrl=>setProfile(p=>({...p,coverUrl}))} onError={setError}/>}</div><Field label={'Představení podnikání'}><textarea name="description" defaultValue={profile.description} rows={5} maxLength={5000}/></Field><Field label="Zkušenosti"><textarea name="experience" defaultValue={profile.experience} rows={3} maxLength={3000}/></Field>{company&&<><Field label="Rok založení"><input name="foundedYear" type="number" min={1000} max={new Date().getFullYear()} defaultValue={profile.foundedYear??''}/></Field><Field label="Reference"><textarea name="referencesText" defaultValue={profile.referencesText} rows={3} maxLength={5000}/></Field></>}<Field label="Web"><input name="website" type="url" placeholder="https://" defaultValue={data.business.website||profile.website} maxLength={2048}/></Field><Field label="Sociální sítě" hint="HTTPS adresy, každá na samostatném řádku."><textarea name="socialLinks" defaultValue={profile.socialLinks.join('\n')} maxLength={10000} rows={3}/></Field><h2>Fotografie realizací</h2><div className="m-portfolio-edit">{profile.portfolio.map((item,index)=><div key={index}><MediaField label={'Realizace '+(index+1)} value={item.imageUrl} onChange={imageUrl=>setProfile(p=>({...p,portfolio:imageUrl?p.portfolio.map((v,i)=>i===index?{...v,imageUrl}:v):p.portfolio.filter((_,i)=>i!==index)}))} onError={setError}/><Field label="Popisek realizace"><input value={item.title} maxLength={160} onChange={e=>setProfile(p=>({...p,portfolio:p.portfolio.map((v,i)=>i===index?{...v,title:e.target.value}:v)}))}/></Field></div>)}</div>{profile.portfolio.length<12&&<MediaField label="Přidat fotografii realizace" value="" onChange={imageUrl=>{if(imageUrl)setProfile(p=>({...p,portfolio:[...p.portfolio,{imageUrl,title:''}]}));}} onError={setError}/>}<p>Profilové údaje a fotografie jsou volitelné. Doplníte je i později v nastavení.</p></>}
      {error&&<p className="p-error" role="alert">{error}</p>}<div className="m-form-actions">{current>1&&!customer&&<button type="button" className="p-button p-secondary" disabled={busy} onClick={()=>{setStep(current-1);setError('');}}>Zpět</button>}<PanelButton type="submit" disabled={busy}>{busy?'Ukládám…':edit?'Uložit změny':customer||current===5?'Dokončit nastavení':'Uložit a pokračovat'}</PanelButton></div>{edit&&<Link href={destination(context)} className="m-text-button">Zpět do přehledu</Link>}
    </form>
  </section>;
}
