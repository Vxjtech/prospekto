'use client';
import Link from 'next/link';
import {JobApply} from './apply';
import {educationLevels,employmentTypes,experienceLevels,jobCategories,salaryLabel,type Job,workModes} from '@/lib/jobs/model';
import {regionLabel} from '@/lib/company-types';

export function JobDetail({job,name,backHref}:{job:Job;name:string;backHref:string}) {
 return <article className="j-public">
  <Link className="m-text-button" href={backHref}>← Všechny pracovní nabídky</Link>
  <header className="j-job-heading"><span className="m-eyebrow">{jobCategories[job.category]}</span><h2>{job.title}</h2><strong>{job.companyName}</strong><p>{job.city} · {regionLabel(job.region)}</p><strong className="j-salary">{salaryLabel(job)}</strong><p>{job.employmentTypes.map(type=>employmentTypes[type]).join(' / ')} · {workModes[job.workMode]}</p></header>
  <div className="j-detail-grid">
   <div className="m-records">
    <section className="p-card"><h3>O pracovní pozici</h3><p className="m-prewrap">{job.description}</p></section>
    {([['Náplň práce',job.responsibilities],['Co od vás očekáváme',job.requirements],['Co nabízíme',job.benefits]] as const).filter(([,text])=>text).map(([title,text])=><section className="p-card" key={title}><h3>{title}</h3><p className="m-prewrap">{text}</p></section>)}
    <section className="p-card">{job.accountId&&<JobApply jobId={job.id} name={name}/>}</section>
   </div>
   <aside className="m-records"><section className="p-card"><h3>Informace o pozici</h3><dl className="j-facts">{[['Firma',job.companyName],['Místo práce',[job.address,job.city].filter(Boolean).join(', ')],['Spolupráce',job.employmentTypes.map(type=>employmentTypes[type]).join(', ')],['Režim práce',workModes[job.workMode]],['Vzdělání',educationLevels[job.education]],['Praxe',experienceLevels[job.experience]],['Jazyky',job.languages||'Neuvedeno'],['Nástup',job.startDate?new Date(job.startDate).toLocaleDateString('cs-CZ'):'Dle dohody']].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{job.suitableGraduates&&<p>Vhodné pro absolventy</p>}{job.suitableDisability&&<p>Vhodné pro osoby se zdravotním postižením</p>}</section></aside>
  </div>
 </article>;
}
