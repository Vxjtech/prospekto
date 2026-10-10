'use client';
import {useRef,useState,type FormEvent,type ReactNode} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {Messenger} from '@/components/messenger/messenger';
import {RequestBrowser} from './request-browser';
import {OfferDialog} from './offer-dialog';
import {RequestPhotos} from './request-photos';
import {LayoutDashboard,FileText,MessageSquare,BriefcaseBusiness,CalendarDays,UserRound,Settings,Heart,Search,Plus,ArrowUpRight,Check,LogOut} from 'lucide-react';
import {Logo} from '@/components/prospekto/logo';
import {WorkspaceTabs} from '@/components/prospekto/workspace-tabs';
import {LogoutButton} from '@/components/panel/logout-button';
import {Field,PanelButton,Empty} from '@/components/panel/ui';
import {AccountSwitcher} from '@/components/accounts/account-switcher';
import {CalendarView} from './calendar-view';
import {JobManager} from '@/components/jobs/manager';
import {JobCard} from '@/components/jobs/public';
import {JobDetail} from '@/components/jobs/detail';
import {jobCategories,employmentTypes,workModes,type Job,type JobApplication,type JobPage} from '@/lib/jobs/model';
import {Dialog,DialogContent,DialogDescription,DialogTitle} from '@/components/ui/dialog';
import {canManage,destination,typeLabels,type AccountContext,type OnboardingData,type Service} from '@/lib/accounts/model';
import {normalizeSearch,regionLabel} from '@/lib/company-types';
import {cooperationLabels,requesterLabels,type MarketplaceState,type MarketRequest,type Offer,type Provider,type ProviderProfile} from '@/lib/marketplace/model';
import {CZECH_REGIONS} from '@/lib/company-types';

const providerNav=[['prehled','Přehled',LayoutDashboard],['poptavky','Hledat zakázky',Search],['moje-poptavky','Moje poptávky',FileText],['nabidky','Odeslané nabídky',BriefcaseBusiness],['zakazky','Zakázky',BriefcaseBusiness],['kalendar','Kalendář',CalendarDays],['dodavatele','Hledat dodavatele',Search],['oblibeni','Oblíbení dodavatelé',Heart],['profil','Profil',UserRound]] as const;
const customerNav=[['prehled','Přehled',LayoutDashboard],['poptavky','Moje poptávky',FileText],['nabidky','Nabídky od firem',BriefcaseBusiness],['prace','Pracovní pozice',BriefcaseBusiness],['dodavatele','Hledat dodavatele',Search],['oblibeni','Oblíbení dodavatelé',Heart],['profil','Profil',UserRound]] as const;
const czk=(value:number)=>new Intl.NumberFormat('cs-CZ',{style:'currency',currency:'CZK',maximumFractionDigits:0}).format(value);
const date=(value:string)=>new Date(value).toLocaleDateString('cs-CZ');
const requestStatus:Record<string,string>={OPEN:'Otevřená',ASSIGNED:'Dodavatel vybraný',CLOSED:'Dokončená'};
const offerStatus:Record<string,string>={SENT:'Odeslaná',ACCEPTED:'Přijatá',REJECTED:'Nepřijatá'};
const EmptyState=({title,children,action}:{title:string;children:ReactNode;action?:ReactNode})=><Empty title={title} action={action}>{children}</Empty>;
export function Dashboard({context,initial,view,name,email,services,profile,team,jobs=[],applications=[],jobsPage,jobDetails,jobFilters={},saved=false}:{context:AccountContext;initial:MarketplaceState;view:string;name:string;email:string;services:Service[];profile:OnboardingData|null;team:{name:string;email:string;role:string}[];jobs?:Job[];applications?:JobApplication[];jobsPage?:JobPage;jobDetails?:Job;jobFilters?:Record<string,string>;saved?:boolean}) {
  const account=context.account!,customer=account.type==='CUSTOMER',base=destination(context);
  const nav=customer?customerNav:providerNav;
  const href=(section:string)=>base+(section==='prehled'?'':section+'/');
  const [state,setState]=useState(initial),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
  const [selectedRequestOffers,setSelectedRequestOffers]=useState<{id:string;title:string}|null>(null);
  const [search,setSearch]=useState(''),[category,setCategory]=useState(''),[region,setRegion]=useState('');
  const [requestPhotos,setRequestPhotos]=useState<string[]>([]),[photosUploading,setPhotosUploading]=useState(false);
  const [selectedProvider,setSelectedProvider]=useState<Provider|null>(null);
  const [providerProfile,setProviderProfile]=useState<ProviderProfile|null>(null);
  const [providerProfileLoading,setProviderProfileLoading]=useState(false),[providerProfileError,setProviderProfileError]=useState('');
  const profileRequest=useRef(0);
  const router=useRouter();
  const [offerRequest,setOfferRequest]=useState<{id:string;title:string}|null>(null);
  async function openProviderProfile(provider:Provider) {
    const request=++profileRequest.current;
    setSelectedProvider(provider);setProviderProfile(null);setProviderProfileError('');setProviderProfileLoading(true);
    try {
      const response=await fetch(`/api/marketplace/providers/${encodeURIComponent(provider.id)}/`);
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||'Profil dodavatele se nepodařilo načíst.');
      if(request===profileRequest.current)setProviderProfile(result.profile as ProviderProfile);
    } catch(error) {
      if(request===profileRequest.current)setProviderProfileError(error instanceof Error?error.message:'Profil dodavatele se nepodařilo načíst.');
    } finally {
      if(request===profileRequest.current)setProviderProfileLoading(false);
    }
  }
  function closeProviderProfile() {
    profileRequest.current++;
    setSelectedProvider(null);setProviderProfile(null);setProviderProfileError('');setProviderProfileLoading(false);
  }
  function openChat(offerId:string){router.push(href('zpravy')+'?offer='+encodeURIComponent(offerId));}
  async function act(body:unknown):Promise<boolean> {
    if(busy)return false;setBusy(true);setError('');setNotice('');
    try {
      const response=await fetch('/api/marketplace/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const result=await response.json();if(!response.ok)throw new Error(result.error||'Změnu se nepodařilo uložit.');
      setState(result.state);const action=(body as {action?:string}).action;setNotice(({offer:'Nabídka byla zdarma odeslána. Po přijetí zákazníkem můžete odemknout chat pro tuto zakázku za 49 kreditů.','unlock-chat':'Chat k této zakázce je odemknutý.',request:'Hotovo, poptávka je zveřejněná. Nabídky od dodavatelů najdete u svých poptávek.','accept-offer':'Nabídka byla přijata. Dodavatel může odemknout chat pro tuto zakázku.'} as Record<string,string>)[action??'']??'Hotovo, změny jsou uložené.');return true;
    }catch(error){setError(error instanceof Error?error.message:'Zkuste to znovu.');return false;}finally{setBusy(false);}
  }
  async function submit(event:FormEvent<HTMLFormElement>,build:(values:Record<string,string>)=>unknown,onSaved?:()=>void) {
    event.preventDefault();const form=event.currentTarget;
    const values=Object.fromEntries(new FormData(form)) as Record<string,string>;
    if(await act(build(values))){form.reset();onSaved?.();}
  }
  function requestCards(items:MarketRequest[],owned=customer) {
    return items.length?<div className="m-card-grid">{items.map(r=><article className="p-card m-request-card" key={r.id}><div className="m-card-meta"><span className="p-badge">{services.find(s=>s.id===r.serviceId)?.name}</span><small>{date(r.createdAt)}</small></div><h3>{r.title}</h3><div className="m-request-labels"><span className="p-badge">{requesterLabels[r.requesterType]}</span><span className="p-badge">{cooperationLabels[r.cooperationType]}</span></div><p className="m-clamp">{r.description}</p>{!!r.photos.length&&<div className="m-request-card-photos">{r.photos.map((photo,index)=><img key={photo} src={photo} alt={`Fotografie k poptávce ${index+1}`} loading="lazy"/>)}</div>}<p>{r.city} · {regionLabel(r.region)}</p><div className="m-card-meta"><strong>{r.budgetCzk===null?'Rozpočet dohodou':czk(r.budgetCzk)}</strong><span className="p-badge">{requestStatus[r.status]}</span></div>{r.requesterId===account.id?<div className="m-form-actions"><button className="p-button p-secondary" onClick={()=>setSelectedRequestOffers({id:r.id,title:r.title})}>Nabídky · {state.receivedOffers.filter(o=>o.requestId===r.id).length}</button>{r.status!=='CLOSED'&&<button className="m-text-button" disabled={busy} onClick={()=>void act({action:'close-request',id:r.id})}>Označit dokončené</button>}</div>:<div className="m-form-actions"><button className="p-button" disabled={busy} onClick={()=>setOfferRequest(r)}>Poslat nabídku zdarma <ArrowUpRight size={16}/></button></div>}</article>)}</div>:<EmptyState title={owned?'Vaše první poptávka začíná tady.':'Zatím tu nejsou odpovídající poptávky.'} action={owned?<Link className="p-button" href={href('nova-poptavka')}>Vytvořit poptávku</Link>:<Link className="p-button p-secondary" href="/onboarding/?edit=1&step=3">Upravit služby a oblast</Link>}>{owned?'Popište, s čím potřebujete pomoci. Dodavatelé vám mohou poslat nabídku.':'Nové poptávky se zobrazí podle vašich služeb, měst a vybraných krajů.'}</EmptyState>;
  }
  function offerCards(items:Offer[],asRequester=customer) {
    return <div className="m-card-grid">{items.map(o=><article className="p-card m-request-card" key={o.id}>
      <div className="m-card-meta"><h3>{o.requestTitle}</h3><span className="p-badge">{offerStatus[o.status]}</span></div>
      <strong>{o.providerName} · {czk(o.amountCzk)}</strong><p className="m-prewrap">{o.body}</p>
      {asRequester&&o.status==='SENT'&&state.ownRequests.some(r=>r.id===o.requestId&&r.status==='OPEN')&&<PanelButton disabled={busy} onClick={()=>void act({action:'accept-offer',id:o.id})}>Přijmout nabídku</PanelButton>}
      {o.chatUnlocked?<button className="p-button p-secondary" onClick={()=>openChat(o.id)}>Otevřít chat k zakázce →</button>
        :o.status==='ACCEPTED'?asRequester?<p>Čekáme, až dodavatel odemkne chat pro tuto zakázku. Pro vás je komunikace zdarma.</p>:<><p>Nabídka je přijatá. Odemknutí chatu k této zakázce stojí 49 kreditů.</p><PanelButton disabled={busy||state.credits<49} onClick={async()=>{if(await act({action:'unlock-chat',id:o.id}))openChat(o.id);}}>Odemknout chat · 49 kreditů</PanelButton>{state.credits<49&&<p className="p-error">Nedostatek kreditů. Potřebujete alespoň 49 kreditů.</p>}</>
        :<p>{o.status==='SENT'?'Chat bude dostupný po přijetí nabídky zákazníkem a odemknutí dodavatelem.':'Tato nabídka nebyla přijata.'}</p>}
    </article>)}</div>;
  }
  const pipeline=<section className="m-section"><h2>Přehled nabídek</h2><div className="m-pipeline">{Object.entries(offerStatus).map(([status,label])=><div key={status} className="m-pipeline-column"><h3>{label}<span>{state.offers.filter(o=>o.status===status).length}</span></h3>{state.offers.filter(o=>o.status===status).slice(0,5).map(o=><article key={o.id}><strong>{o.requestTitle}</strong><small>{czk(o.amountCzk)}</small><Link href={href('nabidky')}>Zobrazit nabídku →</Link></article>)}</div>)}</div></section>;
  const tasks=<section className="m-section"><div className="m-section-heading"><h2>Úkoly</h2><Link href={href('kalendar')}>Kalendář <ArrowUpRight size={15}/></Link></div><div className="p-card m-records">{state.tasks.filter(t=>!t.done).slice(0,10).map(t=><label className="m-task" key={t.id}><input type="checkbox" checked={!!t.done} disabled={busy} onChange={e=>void act({action:'task-done',id:t.id,done:e.target.checked})}/><span>{t.title}</span><small>{t.dueAt?date(t.dueAt):'Bez termínu'}</small></label>)}{!state.tasks.some(t=>!t.done)&&<p>Vše vyřízeno. Přidejte si další krok k nové zakázce.</p>}<form className="m-inline-form" onSubmit={e=>void submit(e,v=>({action:'task',title:v.title,dueAt:null}))}><input name="title" aria-label="Nový úkol" placeholder="Např. Zavolat Jan Novák" minLength={2} maxLength={300} required/><PanelButton disabled={busy} type="submit"><Plus size={16}/> Přidat úkol</PanelButton></form></div></section>;
  const stats=<div className="m-stats">{[[state.offers.filter(o=>o.status==='SENT').length,'Čekají na přijetí'],[state.offers.length,'Odeslané nabídky'],[state.offers.filter(o=>o.status==='ACCEPTED').length,'Přijaté nabídky'],[state.credits.toLocaleString('cs-CZ'),'Kredity']].map(([number,label])=><article className="p-card" key={label}><span>{label}</span><strong>{number}</strong></article>)}</div>;
  const selectedOffers=selectedRequestOffers?state.receivedOffers.filter(offer=>offer.requestId===selectedRequestOffers.id):[];
  const jobPageLink=(filters:Record<string,string>,page:number)=>{const params=new URLSearchParams(filters);params.set('page',String(page));return href('prace')+'?'+params.toString();};
  const title=nav.find(([id])=>id===view)?.[1]??(view==='nova-poptavka'?'Vytvořit poptávku':view==='nabor'?'Správa náboru':view==='nastaveni'?'Účet a nastavení':'Nabídky zákazníkům');
  return <div className="p-app m-app"><a className="skip-link" href="#market-content">Přejít na obsah</a><aside className="p-sidebar m-sidebar"><div className="p-sidebar-brand"><Logo plain/>{!customer&&<WorkspaceTabs active="people"/>}</div><nav aria-label={customer?'Zákaznické prostředí':'Prostředí dodavatele'}>{nav.map(([id,label,Icon])=><Link key={id} href={href(id)} className={view===id?'active':''} aria-current={view===id?'page':undefined}><Icon size={19}/>{label}</Link>)}{customer?<Link href="/moje-reakce/"><FileText size={19}/>Moje reakce na práci</Link>:canManage(account.role)&&<Link href="/dodavatel/nabor/" className={view==='nabor'?'active':''} aria-current={view==='nabor'?'page':undefined}><BriefcaseBusiness size={19}/>Správa náboru</Link>}</nav><div className="p-workspace-card"><span>{typeLabels[account.type!]}</span><strong>{account.name}</strong>{!customer&&<Link href="/nastroje/">Databáze firem a kampaně ↗</Link>}</div><Link href={href('nastaveni')} className={`p-sidebar-account ${view==='nastaveni'?'active':''}`} aria-current={view==='nastaveni'?'page':undefined}><Settings size={19}/> Účet a nastavení</Link><LogoutButton className="p-sidebar-exit"><LogOut size={16}/> Odhlásit se</LogoutButton></aside><div className="p-main"><header className="p-topbar m-topbar"><AccountSwitcher context={context}/>{!customer&&<span className="p-badge m-credit-balance" aria-label="Zůstatek kreditů">{state.credits.toLocaleString('cs-CZ')} kreditů · demo</span>}<div className="m-topbar-account"><Link className="m-topbar-messages" href={href('zpravy')} aria-current={view==='zpravy'?'page':undefined}><MessageSquare size={18}/><span>Zprávy</span></Link><div className="m-person"><span className="p-avatar">{name.split(' ').map(n=>n[0]).slice(0,2).join('')}</span><strong>{name}</strong></div></div></header><nav className="m-mobile-nav" aria-label="Mobilní navigace">{nav.map(([id,label])=><Link key={id} href={href(id)} aria-current={view===id?'page':undefined}>{label}</Link>)}<Link href={customer?"/moje-reakce/":"/dodavatel/nabor/"}>{customer?"Moje reakce":"Správa náboru"}</Link><Link href={href('nastaveni')} aria-current={view==='nastaveni'?'page':undefined}>Účet a nastavení</Link></nav><main className="p-content m-content" id="market-content">{view!=='nabor'&&<div className="p-heading"><div><span className="m-eyebrow">{customer?'Vaše Prospekto':'Prostor pro vaše podnikání'}</span><h1>{view==='prehled'?'Dobrý den, '+name.split(' ')[0]+'.':title}</h1>{view!=='kalendar'&&<p>{view==='prehled'?(customer?'Najděte správné lidi pro svůj další projekt.':'Nové příležitosti a rozpracované zakázky na jednom místě.'):account.name}</p>}</div>{view!=='zpravy'&&view!=='kalendar'&&<div className="m-form-actions">{!customer&&<Link className="p-button p-secondary" href={href('poptavky')}>Hledat zakázky <ArrowUpRight size={17}/></Link>}<Link className="p-button" href={href('nova-poptavka')}><Plus size={18}/> Vytvořit poptávku</Link></div>}</div>}
    {error&&<p className="p-error m-notice" role="alert">{error}</p>}{notice&&<p className="m-success m-notice" role="status"><Check size={16}/>{notice}</p>}
    {view==='nabor'&&<JobManager jobs={jobs} applications={applications} companyName={account.name} contactName={name} email={email} saved={saved}/>}
    {view==='prehled'&&customer&&<><section className="m-customer-hero"><span className="m-eyebrow">Od nápadu k hotové práci</span><h2>Co pro vás můžeme<br/>pomoci zařídit?</h2><p>Popište svůj projekt a vyberte si dodavatele podle nabídky, zkušeností a referencí.</p><Link className="p-button" href={href('nova-poptavka')}>Vytvořit poptávku <Plus size={18}/></Link></section><div className="m-stats">{[[state.requests.filter(r=>r.status==='OPEN').length,'Otevřené poptávky'],[state.offers.filter(o=>o.status==='SENT').length,'Nabídky od firem'],[state.messages.length,'Zprávy']].map(([value,label])=><article className="p-card" key={label}><span>{label}</span><strong>{value}</strong></article>)}</div><section className="m-section"><div className="m-section-heading"><h2>Moje poptávky</h2><Link href={href('poptavky')}>Zobrazit všechny ↗</Link></div>{requestCards(state.requests.slice(0,3))}</section></>}
    {view==='prehled'&&!customer&&<>{stats}<section className="p-card m-section"><h2>Hledejte zakázky i spolupracovníky</h2><p>Pošlete nabídku na práci pro sebe, nebo zadejte vlastní poptávku po dodavateli či dlouhodobé spolupráci na IČO.</p><div className="m-form-actions"><Link href={href('moje-poptavky')} className="p-button p-secondary">Moje poptávky · {state.ownRequests.length}</Link></div></section><section className="m-section"><div className="m-section-heading"><h2>Nové poptávky</h2><Link href={href('poptavky')}>Zobrazit všechny ↗</Link></div>{requestCards(state.requests.filter(r=>!state.offers.some(o=>o.requestId===r.id)).slice(0,3))}</section>{pipeline}{tasks}</>}
    {view==='poptavky'&&!customer&&<RequestBrowser services={services} offers={state.offers} busy={busy} onOffer={setOfferRequest}/>}
    {(view==='poptavky'&&customer||view==='moje-poptavky')&&<><div className="m-filters"><input aria-label="Hledat poptávku" placeholder="Hledat podle názvu nebo města" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Obor" value={category} onChange={e=>setCategory(e.target.value)}><option value="">Všechny obory</option>{services.filter(s=>!s.parentId).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><select aria-label="Kraj" value={region} onChange={e=>setRegion(e.target.value)}><option value="">Všechny kraje</option>{CZECH_REGIONS.map(r=><option value={r.id} key={r.id}>{r.label}</option>)}</select></div>{requestCards(state.ownRequests.filter(r=>(!search||normalizeSearch(r.title+' '+r.city).includes(normalizeSearch(search)))&&(!region||r.region===region)&&(!category||r.serviceId===category||services.some(s=>s.id===r.serviceId&&s.parentId===category))),true)}</>}
    {view==='nova-poptavka'&&<form className="p-card p-form m-form-card m-request-create-form" onSubmit={e=>void submit(e,v=>({action:'request',...v,budgetCzk:v.budgetCzk?Number(v.budgetCzk):null,photos:requestPhotos}),()=>{setRequestPhotos([]);setPhotosUploading(false);})}>
      <div className="m-request-form-intro">
        <h2>Popište svou poptávku</h2>
        <p>Přidejte pár informací o tom, co potřebujete. Díky detailům a fotografiím vám dodavatelé připraví přesnější nabídky.</p>
        <span>Zadavatel: <strong>{requesterLabels[account.type!]}</strong></span>
      </div>
      <div className="m-request-form-fields">
        <Field label="Typ spolupráce"><select name="cooperationType" defaultValue="ONE_OFF">{Object.entries(cooperationLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field>
        <Field label="Služba"><select name="serviceId" required defaultValue=""><option value="" disabled>Vyberte službu</option>{services.filter(s=>!s.parentId).map(root=><optgroup key={root.id} label={root.name}>{[root,...services.filter(s=>s.parentId===root.id)].map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</optgroup>)}</select></Field>
        <Field label="Název poptávky"><input name="title" placeholder="Např. Rekonstrukce koupelny" minLength={3} maxLength={160} required/></Field>
        <Field label="Co potřebujete?" hint="Uveďte rozsah práce, termín a další důležité podrobnosti."><textarea name="description" placeholder="Popište, co potřebujete zajistit…" minLength={10} maxLength={5000} rows={5} required/></Field>
        <div className="m-form-grid m-request-location"><Field label="Město"><input name="city" maxLength={160} required/></Field><Field label="Kraj"><select name="region" required defaultValue=""><option value="" disabled>Vyberte kraj</option>{CZECH_REGIONS.map(r=><option value={r.id} key={r.id}>{r.label}</option>)}</select></Field></div>
        <Field label="Rozpočet v Kč (volitelně)"><input name="budgetCzk" type="number" min={0} max={1000000000} placeholder="Nechte prázdné, pokud zatím nevíte"/></Field>
        <RequestPhotos photos={requestPhotos} onChange={setRequestPhotos} onError={setError} onUploadingChange={setPhotosUploading}/>
      </div>
      <div className="m-request-form-footer">
        <Link className="m-text-button" href={href(customer?'poptavky':'moje-poptavky')}>Zpět na moje poptávky</Link>
        <PanelButton disabled={busy||photosUploading} type="submit">{busy?'Zveřejňuji…':'Zveřejnit poptávku'}</PanelButton>
      </div>
    </form>}
    {view==='zakazky'&&!customer&&<>{offerCards(state.offers.filter(o=>o.status==='ACCEPTED'))}{!state.offers.some(o=>o.status==='ACCEPTED')&&<EmptyState title="Zatím žádné přijaté nabídky.">Pošlete nabídku zdarma z přehledu poptávek.</EmptyState>}</>}
    {view==='kalendar'&&!customer&&<CalendarView tasks={state.tasks} busy={busy} onCreate={(title,dueAt)=>act({action:'task',title,dueAt})} onToggle={(id,done)=>act({action:'task-done',id,done})}/>}
    {view==='nabidky'&&<><p className="m-help">{customer?'Vyberte si nabídku a potvrďte ji. Chat zpřístupní dodavatel; vy nic neplatíte.':'Nabídky posíláte zdarma. Po přijetí zákazníkem můžete odemknout samostatný chat ke každé zakázce za 49 kreditů.'}</p>{offerCards(state.offers)}{!state.offers.length&&<EmptyState title="Nabídky jsou zatím prázdné.">{customer?'Jakmile dodavatelé pošlou nabídku k vaší poptávce, najdete ji tady.':'Otevřete Poptávky a u vybrané poptávky klikněte na Poslat nabídku zdarma.'}</EmptyState>}{!customer&&<Link className="p-button m-section" href={href('poptavky')}>Najít poptávku a poslat nabídku zdarma →</Link>}</>}
    {view==='prace'&&customer&&jobDetails&&<JobDetail job={jobDetails} name={name} backHref={href('prace')}/>}
    {view==='prace'&&customer&&jobsPage&&<section className="j-public m-section">
      <form action={href('prace')} method="get" className="p-card j-filters">
        <label className="p-field"><span>Co hledáte?</span><input aria-label="Pozice, firma nebo město" name="q" defaultValue={jobFilters.q??''} placeholder="Např. stavbyvedoucí, elektrikář, Ostrava"/></label>
        <label className="p-field"><span>Obor</span><select aria-label="Obor" name="category" defaultValue={jobFilters.category??''}><option value="">Všechny obory</option>{Object.entries(jobCategories).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
        <label className="p-field"><span>Kraj</span><select aria-label="Kraj" name="region" defaultValue={jobFilters.region??''}><option value="">Celá republika</option>{CZECH_REGIONS.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}</select></label>
        <label className="p-field"><span>Druh spolupráce</span><select aria-label="Druh spolupráce" name="type" defaultValue={jobFilters.type??''}><option value="">Všechny úvazky</option>{Object.entries(employmentTypes).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
        <label className="p-field"><span>Místo výkonu</span><select aria-label="Místo výkonu" name="mode" defaultValue={jobFilters.mode??''}><option value="">Všechny možnosti</option>{Object.entries(workModes).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
        <label className="p-field"><span>Nabízená mzda alespoň (Kč / měsíc)</span><input aria-label="Minimální nabízená mzda" name="salary" type="number" min={0} max={100000000} defaultValue={jobFilters.salary??''}/></label>
        <label className="m-checkbox"><input name="graduates" type="checkbox" value="1" defaultChecked={jobFilters.graduates==='1'}/>Vhodné pro absolventy</label>
        <div className="m-form-actions"><button className="p-button" type="submit">Hledat práci</button></div>
      </form>
      <div className="m-section-heading m-section"><h2>Pracovní nabídky <span className="p-badge">{jobsPage.total}</span></h2></div>
      {jobsPage.items.length?<div className="j-results">{jobsPage.items.map(job=><JobCard key={job.id} job={job} basePath={href('prace')}/>)}</div>:<EmptyState title="Zatím žádná pracovní nabídka.">Zaměstnavatelé mohou přidat své první pracovní pozice.</EmptyState>}
      <nav className="j-pagination" aria-label="Stránkování pracovních nabídek">{jobsPage.page>1&&<Link className="p-button p-secondary" href={jobPageLink(jobFilters,jobsPage.page-1)}>← Předchozí</Link>}<span>Strana {jobsPage.page} z {jobsPage.pages}</span>{jobsPage.page<jobsPage.pages&&<Link className="p-button p-secondary" href={jobPageLink(jobFilters,jobsPage.page+1)}>Další →</Link>}</nav>
    </section>}
    {view==='zpravy'&&<Messenger offersHref={href('nabidky')} incomingOffersHref={customer?undefined:href('moje-poptavky')} reviewRequests={customer?state.ownRequests.flatMap(r=>r.status==='CLOSED'?state.receivedOffers.filter(o=>o.requestId===r.id&&o.status==='ACCEPTED'&&!state.givenReviews.some(review=>review.requestId===r.id)).map(()=>({requestId:r.id,title:r.title})):[]):state.customerReviewRequests} reviewTarget={customer?'provider':'customer'} onReview={review=>act({action:customer?'review':'review-customer',...review})}/>}
    {(view==='dodavatele'||view==='oblibeni')&&<><div className="m-filters"><input aria-label="Hledat dodavatele" placeholder="Jméno, služba nebo město" value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="m-card-grid">{state.providers.filter(p=>(view!=='oblibeni'||p.favorite)&&normalizeSearch(p.name+' '+p.city+' '+p.serviceNames).includes(normalizeSearch(search))).map(p=><article className="p-card m-provider-card" key={p.id}>{p.avatarUrl&&<img src={p.avatarUrl} alt="" width={64} height={64}/>}<h3><button type="button" className="m-provider-profile-trigger" onClick={()=>void openProviderProfile(p)}>{p.name} ↗</button></h3><p>{p.city} · {p.serviceNames}</p><p className="m-clamp">{p.description||'Dodavatel si zatím nedoplnil představení.'}</p>{p.website&&<a href={p.website} target="_blank" rel="noreferrer" className="m-text-button">Web dodavatele ↗</a>}<Link className="p-button p-secondary" href={state.receivedOffers.some(o=>o.providerId===p.id&&o.chatUnlocked)?href('zpravy'):href(customer?'nabidky':'moje-poptavky')}><MessageSquare size={17}/>{state.receivedOffers.some(o=>o.providerId===p.id&&o.chatUnlocked)?'Otevřít chaty':'Domluva přes přijatou nabídku'}</Link><button className="m-text-button" disabled={busy} onClick={()=>void act({action:'favorite',providerId:p.id,enabled:!p.favorite})}><Heart size={17} fill={p.favorite?'currentColor':'none'}/>{p.favorite?'Odebrat z oblíbených':'Uložit dodavatele'}</button></article>)}</div>{!state.providers.some(p=>(view!=='oblibeni'||p.favorite)&&normalizeSearch(p.name+' '+p.city+' '+p.serviceNames).includes(normalizeSearch(search)))&&<EmptyState title="Zatím žádní dodavatelé v tomto výběru.">Vyzkoušejte jiný hledaný výraz nebo vytvořte poptávku.</EmptyState>}</>}
    {view==='profil'&&customer&&<section className="p-card m-profile m-profile-instagram">
      <header className="m-profile-top">
        <div className="m-profile-avatar m-profile-avatar-placeholder" aria-hidden="true">{account.name.slice(0,1).toUpperCase()}</div>
        <div className="m-profile-info">
          <div className="m-profile-title"><h2>{account.name}</h2></div>
          <p className="m-profile-bio">Vaše hodnocení od řemeslníků, se kterými jste dokončili zakázku.</p>
        </div>
      </header>
      <section className="m-profile-reviews" aria-label="Hodnocení od řemeslníků">
        <h3>Hodnocení od řemeslníků</h3>
        {state.customerReviews.length?state.customerReviews.map(review=><article className="m-review" key={review.id}><strong>{review.providerName} · {review.rating}/5</strong><p className="m-profile-review-request">{review.requestTitle}</p><p>{review.body}</p></article>):<p className="m-profile-empty">Zatím nemáte žádné hodnocení. Řemeslníci vás mohou ohodnotit po dokončení společné zakázky.</p>}
      </section>
    </section>}
    {view==='profil'&&!customer&&profile&&<section className="p-card m-profile m-profile-instagram">
      <header className="m-profile-top">
        {profile.profile.avatarUrl
          ?<img className="m-profile-avatar" src={profile.profile.avatarUrl} alt="" width={112} height={112}/>
          :<div className="m-profile-avatar m-profile-avatar-placeholder" aria-hidden="true">{account.name.slice(0,1).toUpperCase()}</div>}
        <div className="m-profile-info">
          <div className="m-profile-title">
            <h2>{account.name}</h2>
            {canManage(account.role)&&<Link className="p-button p-secondary" href="/onboarding/?edit=1&step=5">Upravit profil</Link>}
          </div>
          <p className="m-profile-meta">
            <span>{profile.profile.portfolio.length} příspěvků</span>
            <span>{profile.area.city} · dojezd {profile.area.maxDistanceKm} km</span>
          </p>
          <p className="m-profile-services">{profile.services.serviceIds.map(id=>services.find(s=>s.id===id)?.name).filter(Boolean).join(' · ')||'Dodavatel'}</p>
          {profile.profile.description&&<p className="m-profile-bio m-prewrap">{profile.profile.description}</p>}
          {(profile.profile.website||profile.profile.socialLinks.length>0)&&<div className="m-profile-links">
            {profile.profile.website&&<a href={profile.profile.website} rel="noreferrer" target="_blank">Web ↗</a>}
            {profile.profile.socialLinks.map(url=><a key={url} href={url} rel="noreferrer" target="_blank">{new URL(url).hostname} ↗</a>)}
          </div>}
        </div>
      </header>
      <section className="m-profile-posts" aria-label="Fotografie realizací">
        <h3>Realizace</h3>
        {profile.profile.portfolio.length
          ?<div className="m-profile-post-grid">{profile.profile.portfolio.map((p,i)=><figure className="m-profile-post" key={i}><img src={p.imageUrl} alt={p.title||'Realizace'} loading="lazy"/>{p.title&&<figcaption>{p.title}</figcaption>}</figure>)}</div>
          :<p className="m-profile-empty">Přidané realizace se zobrazí jako příspěvky.</p>}
      </section>
      <details className="m-profile-more">
        <summary>Další informace o firmě</summary>
        <div className="m-profile-more-content">
          {profile.profile.experience&&<section><h4>Zkušenosti</h4><p className="m-prewrap">{profile.profile.experience}</p></section>}
          {profile.profile.referencesText&&<section><h4>Reference</h4><p className="m-prewrap">{profile.profile.referencesText}</p></section>}
        </div>
      </details>
      <section className="m-profile-reviews" aria-label="Hodnocení od zákazníků">
        <h3>Hodnocení od zákazníků</h3>
        {state.reviews.length?state.reviews.map(r=><article className="m-review" key={r.id}><strong>{r.rating}/5</strong><p>{r.body}</p></article>):<p className="m-profile-empty">Profil zatím nemá žádné hodnocení.</p>}
      </section>
    </section>}
    {view==='nastaveni'&&<div className="m-card-grid"><section className="p-card m-request-card"><h2>Nastavení účtu</h2><p>{name}<br/>{typeLabels[account.type!]} · {account.name}</p>{canManage(account.role)?<Link className="p-button p-secondary" href="/onboarding/?edit=1&step=1">Upravit údaje a profil</Link>:<p>Profil podnikání upravuje vlastník nebo administrátor.</p>}<Link href="/onboarding/?new=1" className="m-text-button">Přidat jiný typ účtu →</Link></section>{!customer&&<section className="p-card m-request-card"><h2>Vaše obchodní nástroje</h2><p>Databáze firem, uložené seznamy, kampaně a nastavení e-mailového bota.</p><Link className="p-button p-secondary" href="/nastroje/">Otevřít nástroje</Link></section>}{account.type==='COMPANY'&&canManage(account.role)&&<section className="p-card m-request-card"><h2>Členové účtu</h2>{team.map(m=><div key={m.email}><strong>{m.name}</strong><p>{m.email} · {({COMPANY_OWNER:'Vlastník',COMPANY_ADMIN:'Administrátor',COMPANY_MEMBER:'Člen týmu'} as Record<string,string>)[m.role]??m.role}</p></div>)}<p>Správa pozvánek členů týmu bude doplněna v další verzi.</p></section>}</div>}
    <Dialog open={!!selectedProvider} onOpenChange={open=>{if(!open)closeProviderProfile();}}>
      <DialogContent className="m-provider-dialog">
        <DialogTitle className="sr-only">{providerProfile?.name??selectedProvider?.name??'Profil dodavatele'}</DialogTitle>
        <DialogDescription className="sr-only">Profil dodavatele a jeho fotografie realizací.</DialogDescription>
        {providerProfileLoading&&<p className="m-provider-dialog-state" role="status">Načítám profil dodavatele…</p>}
        {providerProfileError&&<div className="m-provider-dialog-state" role="alert">
          <p>{providerProfileError}</p>
          {selectedProvider&&<div className="m-provider-dialog-actions">
            <button className="p-button p-secondary" type="button" onClick={()=>void openProviderProfile(selectedProvider)}>Zkusit znovu</button>
            <Link className="m-text-button" href={'/dodavatele/'+selectedProvider.id+'/'}>Otevřít samostatný profil</Link>
          </div>}
        </div>}
        {providerProfile&&<article className="m-profile-instagram m-provider-dialog-profile">
          <header className="m-profile-top">
            {providerProfile.avatarUrl
              ?<img className="m-profile-avatar" src={providerProfile.avatarUrl} alt="" width={112} height={112}/>
              :<div className="m-profile-avatar m-profile-avatar-placeholder" aria-hidden="true">{providerProfile.name.slice(0,1).toUpperCase()}</div>}
            <div className="m-profile-info">
              <div className="m-profile-title"><h2>{providerProfile.name}</h2></div>
              <p className="m-profile-meta">
                <span>{providerProfile.portfolio.length} příspěvků</span>
                <span>{providerProfile.city}{providerProfile.maxDistanceKm?` · dojezd ${providerProfile.maxDistanceKm} km`:''}</span>
              </p>
              <p className="m-profile-services">{providerProfile.services.join(' · ')||'Dodavatel'}</p>
              {providerProfile.description&&<p className="m-profile-bio m-prewrap">{providerProfile.description}</p>}
              {(providerProfile.website||providerProfile.socialLinks.length>0)&&<div className="m-profile-links">
                {providerProfile.website&&<a href={providerProfile.website} rel="noreferrer" target="_blank">Web ↗</a>}
                {providerProfile.socialLinks.map(url=><a key={url} href={url} rel="noreferrer" target="_blank">{new URL(url).hostname} ↗</a>)}
              </div>}
            </div>
          </header>
          <section className="m-profile-posts" aria-label="Fotografie realizací">
            <h3>Realizace</h3>
            {providerProfile.portfolio.length
              ?<div className="m-profile-post-grid">{providerProfile.portfolio.map((item,i)=><figure className="m-profile-post" key={i}><img src={item.imageUrl} alt={item.title||'Realizace'} loading="lazy"/>{item.title&&<figcaption>{item.title}</figcaption>}</figure>)}</div>
              :<p className="m-profile-empty">Dodavatel zatím nepřidal fotografie realizací.</p>}
          </section>
          <details className="m-profile-more">
            <summary>Další informace o firmě</summary>
            <div className="m-profile-more-content">
              {providerProfile.experience&&<section><h4>Zkušenosti</h4><p className="m-prewrap">{providerProfile.experience}</p></section>}
              <section><h4>Údaje o firmě</h4><p>IČO: {providerProfile.ico}{providerProfile.foundedYear?` · Rok založení: ${providerProfile.foundedYear}`:''}</p></section>
              {providerProfile.referencesText&&<section><h4>Reference</h4><p className="m-prewrap">{providerProfile.referencesText}</p></section>}
            </div>
          </details>
          <section className="m-profile-reviews" aria-label="Hodnocení od zákazníků">
            <h3>Hodnocení od zákazníků</h3>
            {providerProfile.reviews.length?providerProfile.reviews.map(review=><article className="m-review" key={review.id}><strong>{review.rating}/5</strong><p>{review.body}</p></article>):<p className="m-profile-empty">Dodavatel zatím nemá hodnocení.</p>}
          </section>
        </article>}
      </DialogContent>
    </Dialog>
    <Dialog open={!!selectedRequestOffers} onOpenChange={open=>{if(!open)setSelectedRequestOffers(null);}}>
      <DialogContent className="m-provider-dialog m-request-offers-dialog">
        <DialogTitle className="m-request-offers-title">Nabídky k poptávce</DialogTitle>
        <DialogDescription className="m-request-offers-description">{selectedRequestOffers?.title}</DialogDescription>
        {selectedOffers.length?offerCards(selectedOffers,true):<p className="m-request-offers-empty">Na tuto poptávku zatím nikdo neodpověděl.</p>}
      </DialogContent>
    </Dialog>
    <OfferDialog request={offerRequest} onClose={()=>setOfferRequest(null)} onSend={act} errorMessage={error}/>
  </main></div></div>;
}
