import {notFound} from 'next/navigation';
import Link from 'next/link';
import {getUser} from '@/lib/auth';
import {getContext} from '@/lib/accounts/store';
import {publicJob} from '@/lib/jobs/store';
import {employmentTypes,workModes,educationLevels,experienceLevels,jobCategories,salaryLabel} from '@/lib/jobs/model';
import {regionLabel} from '@/lib/company-types';
import {Logo} from '@/components/prospekto/logo';
import {JobApply} from '@/components/jobs/apply';
import '@/app/panel/panel.css';
import '@/app/marketplace.css';
import '../jobs.css';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{id:string}>}){const job=publicJob((await params).id);return {title:job?job.title+' – '+job.companyName+' | Prospekto':'Nabídka není dostupná | Prospekto',description:job?.description.slice(0,160)};}
export default async function Page({params}:{params:Promise<{id:string}>}){
 const job=publicJob((await params).id);if(!job)notFound();
 const user=await getUser(),context=user?getContext(user):null;
 const canApply=context?.account?.type==='CUSTOMER'&&!!context.account.completedAt;
 const schemaTypes={FULL_TIME:'FULL_TIME',PART_TIME:'PART_TIME',DPP:'TEMPORARY',DPC:'TEMPORARY',CONTRACTOR:'CONTRACTOR',INTERNSHIP:'INTERN'};
 const structured={
  '@context':'https://schema.org','@type':'JobPosting',title:job.title,
  description:job.description+'\n\nNáplň práce\n'+job.responsibilities+'\n\nPožadavky\n'+job.requirements+'\n\nBenefity\n'+job.benefits,
  identifier:{'@type':'PropertyValue',name:'Prospekto',value:job.id},
  datePosted:job.publishedAt,validThrough:job.expiresAt+'T23:59:59Z',
  hiringOrganization:{'@type':'Organization',name:job.companyName},
  employmentType:job.employmentTypes.map(t=>schemaTypes[t]),
  jobLocation:{'@type':'Place',address:{'@type':'PostalAddress',streetAddress:job.address,addressLocality:job.city,addressRegion:regionLabel(job.region),addressCountry:'CZ'}},
  ...(job.workMode==='REMOTE'?{jobLocationType:'TELECOMMUTE',applicantLocationRequirements:{'@type':'Country',name:'Czech Republic'}}:{}),
  ...(job.salaryMin!==null||job.salaryMax!==null?{baseSalary:{'@type':'MonetaryAmount',currency:'CZK',value:{'@type':'QuantitativeValue',...(job.salaryMin!==null?{minValue:job.salaryMin}:{}),...(job.salaryMax!==null?{maxValue:job.salaryMax}:{}),unitText:job.salaryPeriod}}}:{}),
 };
 return <main className="m-onboarding p-app"><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(structured).replace(/</g,'\\u003c')}}/><header className="m-public-header"><Logo/><Link href="/prace/">← Všechny pracovní nabídky</Link></header><article className="j-public"><div className="j-job-heading"><span className="m-eyebrow">{jobCategories[job.category]}</span><h1>{job.title}</h1><Link href={'/dodavatele/'+job.accountId+'/'}>{job.companyName} ↗</Link><p>{job.city} · {regionLabel(job.region)}</p><strong className="j-salary">{salaryLabel(job)}</strong><p>{job.employmentTypes.includes('CONTRACTOR')?'Odměna dle typu smlouvy; podrobnosti upřesní zaměstnavatel.':'Uvedená mzda je hrubá.'}</p></div><div className="j-detail-grid"><div className="m-records"><section className="p-card"><h2>O pracovní pozici</h2><p className="m-prewrap">{job.description}</p></section>{[['Náplň práce',job.responsibilities],['Co od vás očekáváme',job.requirements],['Co nabízíme',job.benefits]].map(([title,text])=>text?<section className="p-card" key={title}><h2>{title}</h2><p className="m-prewrap">{text}</p></section>:null)}<section className="p-card" id="reakce">{canApply?<JobApply jobId={job.id} name={user?.fullName??''}/>:<><h2>Zaujala vás nabídka?</h2><p>{user?'Pro reakci v Prospektu si přepněte na dokončený osobní účet.':'Přihlaste se jako zákazník a reagujte přímo v Prospektu, nebo využijte kontakt zaměstnavatele.'}</p><Link className="p-button m-section" href={user?'/panel/':'/prihlaseni/'}>{user?'Moje Prospekto':'Přihlásit se'}</Link></>}</section></div><aside className="m-records"><section className="p-card"><h2>Informace o pozici</h2><dl className="j-facts">{[['Firma',job.companyName],['IČO',job.companyIco],['Místo práce',[job.address,job.city].filter(Boolean).join(', ')],['Spolupráce',job.employmentTypes.map(t=>employmentTypes[t]).join(', ')],['Režim práce',workModes[job.workMode]],['Vzdělání',educationLevels[job.education]],['Praxe',experienceLevels[job.experience]],['Jazyky',job.languages||'Neuvedeno'],['Nástup',job.startDate?new Date(job.startDate).toLocaleDateString('cs-CZ'):'Dle dohody'],['Platnost nabídky do',new Date(job.expiresAt).toLocaleDateString('cs-CZ')]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{job.suitableGraduates&&<p>Vhodné pro absolventy</p>}{job.suitableDisability&&<p>Vhodné pro osoby se zdravotním postižením</p>}</section><section className="p-card j-contact"><h2>Kontakt</h2><strong>{job.contactName}</strong>{job.contactPhone&&<a href={'tel:'+job.contactPhone.replace(/[^\d+]/g,'')}>{job.contactPhone}</a>}{job.contactEmail&&<a href={'mailto:'+job.contactEmail+'?subject='+encodeURIComponent('Reakce na pozici: '+job.title)}>{job.contactEmail}</a>}{job.applyUrl&&<a className="p-button p-secondary" href={job.applyUrl} target="_blank" rel="noreferrer">Odpovědět na webu firmy ↗</a>}<Link className="p-button" href="#reakce">Reagovat v Prospektu</Link></section></aside></div></article></main>;
}
