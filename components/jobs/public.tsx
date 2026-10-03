import Link from 'next/link';
import {jobCategories,employmentTypes,workModes,salaryLabel,type Job} from '@/lib/jobs/model';
import {regionLabel} from '@/lib/company-types';
export function JobCard({job}:{job:Job}) {
 return <article className="p-card j-card"><div className="m-card-meta"><span className="p-badge">{jobCategories[job.category]}</span><small>{job.publishedAt?new Date(job.publishedAt).toLocaleDateString('cs-CZ'):''}</small></div><h2><Link href={'/prace/'+job.id+'/'}>{job.title}</Link></h2><strong>{job.companyName}</strong><p>{job.city} · {regionLabel(job.region)}</p><p>{job.employmentTypes.map(t=>employmentTypes[t]).join(' / ')} · {workModes[job.workMode]}</p><strong className="j-salary">{salaryLabel(job)}</strong><p className="m-clamp">{job.description}</p><div className="m-card-meta">{job.suitableGraduates&&<span className="p-badge">Vhodné pro absolventy</span>}<Link className="p-button p-secondary" href={'/prace/'+job.id+'/'}>Detail pozice →</Link></div></article>;
}
