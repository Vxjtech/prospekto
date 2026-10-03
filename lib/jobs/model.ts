import {z} from 'zod';
import {CZECH_REGIONS} from '@/lib/company-types';
export const jobCategories={construction:'Stavebnictví a reality',manufacturing:'Výroba a průmysl',logistics:'Doprava a logistika',sales:'Obchod a prodej',administration:'Administrativa',it:'IT a technologie',finance:'Finance a účetnictví',health:'Zdravotnictví',education:'Vzdělávání',hospitality:'Gastronomie a cestovní ruch',services:'Služby a řemesla',management:'Management',marketing:'Marketing a média',other:'Ostatní'} as const;
export const employmentTypes={FULL_TIME:'Plný úvazek',PART_TIME:'Zkrácený úvazek',DPP:'DPP / brigáda',DPC:'DPČ',CONTRACTOR:'Spolupráce na IČO',INTERNSHIP:'Stáž'} as const;
export const workModes={ONSITE:'Na pracovišti',HYBRID:'Hybridně',REMOTE:'Práce na dálku'} as const;
export const educationLevels={ANY:'Nerozhoduje',BASIC:'Základní',VOCATIONAL:'Vyučení',SECONDARY:'Středoškolské s maturitou',HIGHER:'Vyšší odborné',UNIVERSITY:'Vysokoškolské'} as const;
export const experienceLevels={ANY:'Nerozhoduje',JUNIOR:'Bez praxe / junior',EXPERIENCED:'S praxí',SENIOR:'Senior / vedoucí'} as const;
export const salaryPeriods={MONTH:'měsíc',HOUR:'hodinu',YEAR:'rok'} as const;
const keys=<T extends Record<string,string>>(v:T)=>Object.keys(v) as [keyof T & string,...(keyof T & string)[]];
const text=(max:number)=>z.string().trim().max(max);
const url=z.union([z.literal(''),text(2048).url().refine(v=>{try{return new URL(v).protocol==='https:';}catch{return false;}},'Použijte HTTPS adresu.')]);
const phone=text(30).refine(v=>!v||(/^\+?[\d ()-]+$/.test(v)&&v.replace(/\D/g,'').length>=7),'Zkontrolujte telefon.');
const date=text(10).regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v;},'Neplatné datum.');
export const jobInput=z.object({
 title:text(160).min(3,'Vyplňte název pozice.'),category:z.enum(keys(jobCategories)),
 city:text(160).min(1,'Vyplňte město nebo výchozí lokalitu.'),region:z.string().refine(v=>CZECH_REGIONS.some(r=>r.id===v),'Vyberte kraj.'),address:text(300).default(''),
 employmentTypes:z.array(z.enum(keys(employmentTypes))).min(1,'Vyberte druh spolupráce.').max(6).transform(v=>[...new Set(v)]),
 workMode:z.enum(keys(workModes)),salaryMin:z.number().int().min(0).max(100000000).nullable(),salaryMax:z.number().int().min(0).max(100000000).nullable(),salaryPeriod:z.enum(keys(salaryPeriods)),
 description:text(10000).min(20,'Představte pozici alespoň 20 znaky.'),responsibilities:text(10000).min(10,'Doplňte náplň práce.'),requirements:text(10000).min(10,'Doplňte požadavky.'),benefits:text(6000).default(''),
 education:z.enum(keys(educationLevels)),experience:z.enum(keys(experienceLevels)),languages:text(1000).default(''),
 suitableGraduates:z.boolean(),suitableDisability:z.boolean(),contactName:text(120).min(1,'Doplňte kontaktní osobu.'),
 contactEmail:z.union([z.literal(''),text(254).email()]),contactPhone:phone,applyUrl:url,startDate:z.union([z.literal(''),date]),
 expiresAt:date,status:z.enum(['DRAFT','PUBLISHED','CLOSED']),
}).strict().refine(d=>d.salaryMin===null||d.salaryMax===null||d.salaryMax>=d.salaryMin,{message:'Horní hranice mzdy musí být alespoň spodní hranice.',path:['salaryMax']})
.refine(d=>!!d.contactEmail||!!d.contactPhone||!!d.applyUrl,{message:'Vyplňte e-mail, telefon nebo odkaz pro odpověď.',path:['contactEmail']})
.refine(d=>d.status!=='PUBLISHED'||d.expiresAt>=new Date().toISOString().slice(0,10),{message:'Pro zveřejnění nastavte budoucí datum platnosti.',path:['expiresAt']});
export type JobInput=z.infer<typeof jobInput>;
export type Job=JobInput&{id:string;accountId:string;companyName:string;companyIco:string;companyLogo:string;publishedAt:string|null;createdAt:string;updatedAt:string};
export type JobApplication={id:string;jobId:string;jobTitle:string;companyName:string;name:string;email:string;phone:string;message:string;resumeUrl:string;createdAt:string};
export const applicationInput=z.object({jobId:z.string().uuid(),name:text(160).min(2),phone,message:text(6000).min(10,'Napište alespoň krátké představení.'),resumeUrl:url.default('')}).strict();
export const jobAction=z.discriminatedUnion('action',[
 z.object({action:z.literal('save'),id:z.string().uuid().optional(),data:jobInput}).strict(),
 z.object({action:z.literal('close'),id:z.string().uuid()}).strict(),
 z.object({action:z.literal('apply'),data:applicationInput}).strict(),
]);
export function salaryLabel(j:Pick<JobInput,'salaryMin'|'salaryMax'|'salaryPeriod'>) {
 const f=(n:number)=>new Intl.NumberFormat('cs-CZ').format(n);
 if(j.salaryMin===null&&j.salaryMax===null)return 'Mzda neuvedena';
 return (j.salaryMin!==null&&j.salaryMax!==null?f(j.salaryMin)+'–'+f(j.salaryMax):j.salaryMin!==null?'od '+f(j.salaryMin):'až '+f(j.salaryMax!))+' Kč / '+salaryPeriods[j.salaryPeriod];
}
export type JobPage={items:Job[];total:number;page:number;pages:number};
