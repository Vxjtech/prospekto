import 'server-only';
import {query} from '@/db';
import type {SQLInputValue} from 'node:sqlite';
import type {User} from '@/lib/auth';
import {requireAccount,requireManager} from '@/lib/accounts/store';
import {HttpError} from '@/lib/http';
import type {Job,JobInput,JobApplication,JobPage,applicationInput} from './model';
import type {z} from 'zod';

const columns='j.id,j.account_id AS accountId,a.name AS companyName,p.ico AS companyIco,p.avatar_url AS companyLogo,j.title,j.category,j.city,j.region,j.address,j.employment_types AS employmentTypes,j.work_mode AS workMode,j.salary_min AS salaryMin,j.salary_max AS salaryMax,j.salary_period AS salaryPeriod,j.description,j.responsibilities,j.requirements,j.benefits,j.education,j.experience,j.languages,j.suitable_graduates AS suitableGraduates,j.suitable_disability AS suitableDisability,j.contact_name AS contactName,j.contact_email AS contactEmail,j.contact_phone AS contactPhone,j.apply_url AS applyUrl,j.start_date AS startDate,j.expires_at AS expiresAt,j.status,j.published_at AS publishedAt,j.created_at AS createdAt,j.updated_at AS updatedAt';
const joins=' FROM job_postings j JOIN accounts a ON a.id=j.account_id JOIN provider_profiles p ON p.account_id=a.id';
const visible="j.status='PUBLISHED' AND j.expires_at>=date('now') AND a.completed_at IS NOT NULL";
type Row=Omit<Job,'employmentTypes'|'suitableGraduates'|'suitableDisability'>&{employmentTypes:string;suitableGraduates:number;suitableDisability:number};
const hydrate=(r:Row):Job=>({...r,employmentTypes:JSON.parse(r.employmentTypes),suitableGraduates:!!r.suitableGraduates,suitableDisability:!!r.suitableDisability});
export function publicJobs(params:URLSearchParams):JobPage {
 const clauses=[visible],values:SQLInputValue[]=[];
 const q=(params.get('q')??'').trim().slice(0,160);
 if(q){clauses.push("instr(lower(j.title||' '||a.name||' '||j.city),lower(?))>0");values.push(q);}
 for(const [filter,column] of [['category','j.category'],['region','j.region'],['mode','j.work_mode']] as const){const value=params.get(filter);if(value){clauses.push(column+'=?');values.push(value.slice(0,80));}}
 if(params.get('type')){clauses.push('EXISTS(SELECT 1 FROM json_each(j.employment_types) WHERE value=?)');values.push(params.get('type'));}
 if(params.get('graduates')==='1')clauses.push('j.suitable_graduates=1');
 const minimum=Number(params.get('salary')??0);
 if(Number.isFinite(minimum)&&minimum>0){clauses.push("j.salary_period='MONTH' AND COALESCE(j.salary_max,j.salary_min)>=?");values.push(minimum);}
 const where=' WHERE '+clauses.join(' AND ');
 const total=query('SELECT COUNT(*) AS n'+joins+where,...values).get<{n:number}>()!.n;
 const pages=Math.max(1,Math.ceil(total/20)),page=Math.max(1,Math.min(pages,Number.parseInt(params.get('page')??'1',10)||1));
 const items=query('SELECT '+columns+joins+where+' ORDER BY j.published_at DESC,j.id LIMIT 20 OFFSET ?',...values,(page-1)*20).all<Row>().map(hydrate);
 return {items,total,page,pages};
}
export function publicJob(id:string):Job|null {
 const row=query('SELECT '+columns+joins+' WHERE '+visible+' AND j.id=?',id).get<Row>();
 return row?hydrate(row):null;
}
export function employerJobs(user:User):Job[] {
 const account=requireAccount(user,'provider');
 return query('SELECT '+columns+joins+' WHERE j.account_id=? ORDER BY j.updated_at DESC LIMIT 500',account.id).all<Row>().map(hydrate);
}
const fieldMap:Record<keyof JobInput,string>={title:'title',category:'category',city:'city',region:'region',address:'address',employmentTypes:'employment_types',workMode:'work_mode',salaryMin:'salary_min',salaryMax:'salary_max',salaryPeriod:'salary_period',description:'description',responsibilities:'responsibilities',requirements:'requirements',benefits:'benefits',education:'education',experience:'experience',languages:'languages',suitableGraduates:'suitable_graduates',suitableDisability:'suitable_disability',contactName:'contact_name',contactEmail:'contact_email',contactPhone:'contact_phone',applyUrl:'apply_url',startDate:'start_date',expiresAt:'expires_at',status:'status'};
// Called inside a synchronous transaction by the API.
export function saveJob(user:User,data:JobInput,id?:string) {
 const account=requireAccount(user,'provider');requireManager(user,true);
 const now=new Date().toISOString(),jobId=id??crypto.randomUUID();
 const existing=id?query('SELECT id,published_at FROM job_postings WHERE id=? AND account_id=?',id,account.id).get<{id:string;published_at:string|null}>():null;
 if(id&&!existing)throw new HttpError(404,'Nabídka nebyla nalezena.');
 if(!id&&(query('SELECT COUNT(*) AS n FROM job_postings WHERE account_id=?',account.id).get<{n:number}>()?.n??0)>=500)throw new HttpError(409,'Účet může mít nejvýše 500 pracovních nabídek.');
 const keys=Object.keys(fieldMap) as (keyof JobInput)[];
 const values=keys.map(k=>{const v=data[k];return Array.isArray(v)?JSON.stringify(v):typeof v==='boolean'?Number(v):v;});
 const publishedAt=data.status==='PUBLISHED'?(existing?.published_at??now):existing?.published_at??null;
 if(id)query('UPDATE job_postings SET '+keys.map(k=>fieldMap[k]+'=?').join(',')+',published_at=?,updated_at=? WHERE id=? AND account_id=?',...values,publishedAt,now,id,account.id).run();
 else query('INSERT INTO job_postings('+keys.map(k=>fieldMap[k]).join(',')+',id,account_id,created_by,published_at,created_at,updated_at) VALUES('+Array(keys.length+6).fill('?').join(',')+')',...values,jobId,account.id,user.userId,publishedAt,now,now).run();
 return jobId;
}
export function closeJob(user:User,id:string) {
 const account=requireAccount(user,'provider');requireManager(user,true);
 if(!query("UPDATE job_postings SET status='CLOSED',updated_at=? WHERE id=? AND account_id=?",new Date().toISOString(),id,account.id).run().changes)throw new HttpError(404,'Nabídka nebyla nalezena.');
}
export function applyToJob(user:User,input:z.infer<typeof applicationInput>) {
 const account=requireAccount(user,'customer');
 if(!publicJob(input.jobId))throw new HttpError(404,'Nabídka již není dostupná.');
 if(query('SELECT 1 FROM job_applications WHERE job_id=? AND customer_account_id=?',input.jobId,account.id).get())throw new HttpError(409,'Na tuto pozici už jste reagovali.');
 query('INSERT INTO job_applications(id,job_id,customer_account_id,user_id,name,email,phone,message,resume_url,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',crypto.randomUUID(),input.jobId,account.id,user.userId,input.name,user.email,input.phone,input.message,input.resumeUrl,new Date().toISOString()).run();
}
export function applications(user:User):JobApplication[] {
 const account=requireAccount(user),customer=account.type==='CUSTOMER';
 if(!customer)requireManager(user,true);
 return query('SELECT r.id,r.job_id AS jobId,j.title AS jobTitle,a.name AS companyName,r.name,r.email,r.phone,r.message,r.resume_url AS resumeUrl,r.created_at AS createdAt FROM job_applications r JOIN job_postings j ON j.id=r.job_id JOIN accounts a ON a.id=j.account_id WHERE '+(customer?'r.customer_account_id':'j.account_id')+'=? ORDER BY r.created_at DESC LIMIT 1000',account.id).all<JobApplication>();
}
