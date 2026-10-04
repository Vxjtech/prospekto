import {notFound} from 'next/navigation';
import Link from 'next/link';
import {query} from '@/db';
import {getUser} from '@/lib/auth';
import {chatAccess} from '@/lib/messenger/access';
import {getContext} from '@/lib/accounts/store';
import {destination} from '@/lib/accounts/model';
import {Logo} from '@/components/prospekto/logo';
import '@/app/panel/panel.css';
import '@/app/marketplace.css';
export const dynamic='force-dynamic';
export const metadata={title:'Profil dodavatele | Prospekto'};
export default async function Page({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  const user=await getUser(),context=user?getContext(user):null;
  const canChat=!!context?.account?.completedAt&&chatAccess(context.account.id,id).allowed;
  const messageUrl=context?.account?.completedAt?destination(context)+(canChat?'zpravy/?contact='+encodeURIComponent(id):'nabidky/'):user?'/onboarding/':'/prihlaseni/';
  const p=query('SELECT a.name,p.business_name,p.ico,p.description,p.avatar_url,p.cover_url,p.experience,p.website,p.social_links,s.city,s.max_distance_km,c.founded_year,c.references_text FROM provider_profiles p JOIN accounts a ON a.id=p.account_id LEFT JOIN service_areas s ON s.account_id=a.id LEFT JOIN company_profiles c ON c.account_id=a.id WHERE a.id=? AND a.completed_at IS NOT NULL',id).get<{name:string;business_name:string;ico:string;description:string;avatar_url:string;cover_url:string;experience:string;website:string;social_links:string;city:string;max_distance_km:number;founded_year:number|null;references_text:string|null}>();
  if(!p)notFound();
  const services=query('SELECT s.name FROM services s JOIN provider_services ps ON ps.service_id=s.id WHERE ps.account_id=?',id).all<{name:string}>();
  const portfolio=query('SELECT image_url,title FROM portfolio_items WHERE account_id=? ORDER BY position',id).all<{image_url:string;title:string}>();
  const reviews=query('SELECT rating,body FROM reviews WHERE provider_account_id=? ORDER BY created_at DESC LIMIT 100',id).all<{rating:number;body:string}>();
  const social=JSON.parse(p.social_links) as string[];
  return <main className="m-onboarding p-app"><header className="m-public-header"><Logo/><Link href="/panel/">Moje Prospekto →</Link></header><section className="m-wizard m-section"><article className="p-card m-profile">{p.cover_url&&<img className="m-cover" src={p.cover_url} alt="Titulní fotografie"/>}<div>{p.avatar_url&&<img className="m-profile-avatar" src={p.avatar_url} alt="" width={96} height={96}/>}<span className="m-eyebrow">Dodavatel na Prospektu</span><h1>{p.name}</h1><p>{p.city} · dojezd {p.max_distance_km} km</p></div><p className="m-prewrap">{p.description}</p><p>{services.map(s=>s.name).join(' · ')}</p><h2>Zkušenosti</h2><p className="m-prewrap">{p.experience||'Zkušenosti zatím nejsou doplněné.'}</p><p>IČO: {p.ico}{p.founded_year?' · Rok založení: '+p.founded_year:''}</p>{p.website&&<a href={p.website} target="_blank" rel="noreferrer">Web dodavatele ↗</a>}{social.map(url=><a key={url} href={url} target="_blank" rel="noreferrer">{new URL(url).hostname} ↗</a>)}{!!portfolio.length&&<><h2>Realizace</h2><div className="m-portfolio-edit">{portfolio.map((item,i)=><figure key={i}><img src={item.image_url} alt={item.title||'Realizace'}/><figcaption>{item.title}</figcaption></figure>)}</div></>}<h2>Reference a hodnocení</h2>{p.references_text&&<p className="m-prewrap">{p.references_text}</p>}{reviews.map((r,i)=><article className="m-review" key={i}><strong>{r.rating}/5</strong><p>{r.body}</p></article>)}{!reviews.length&&<p>Dodavatel zatím nemá hodnocení z dokončených poptávek.</p>}<div className="m-form-actions">{context?.account?.id!==id&&<Link className="p-button" href={messageUrl}>{user?canChat?'Napsat zprávu':'Domluva přes přijatou nabídku':'Přihlásit se'}</Link>}<Link className="p-button p-secondary" href={context?.account?.completedAt?destination(context)+'nova-poptavka/':'/registrace/'}>Vytvořit poptávku</Link></div></article></section></main>;
}

