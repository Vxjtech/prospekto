import {z} from 'zod';
import {CZECH_REGIONS} from '@/lib/company-types';

export const accountTypes = ['CUSTOMER','COMPANY'] as const;
export type AccountType = typeof accountTypes[number];
export type Role = 'CUSTOMER'|'COMPANY_OWNER'|'COMPANY_ADMIN'|'COMPANY_MEMBER'|'PLATFORM_ADMIN';
export type Account = {id:string; type:AccountType|null; name:string; role:Role|null; step:number; completedAt:string|null};
export type AccountContext = {account:Account|null; accounts:Account[]; platformAdmin:boolean};
export const typeLabels:Record<AccountType,string> = {CUSTOMER:'Osobní účet',COMPANY:'Účet na IČO'};
export const stageLabels = {NEW:'Nový',CONTACTED:'Kontaktován',MEETING:'Schůzka',OFFER:'Nabídka',WON:'Vyhráno',LOST:'Prohráno'} as const;
export type Stage = keyof typeof stageLabels;
export const canManage = (role:Role|null) => role === 'COMPANY_OWNER' || role === 'COMPANY_ADMIN' || role === 'CUSTOMER';
export function destination(context:AccountContext):string {
  if(context.platformAdmin) return '/administrace/';
  const account=context.account;
  if(!account?.type || !account.completedAt) return '/onboarding/';
  return account.type==='CUSTOMER'?'/zakaznik/':'/dodavatel/';
}
const text=(max=160)=>z.string().trim().max(max);
const required=(label:string,max=160)=>text(max).min(1,label);
export const personalInput=z.object({firstName:required('Zadejte jméno.',80),lastName:required('Zadejte příjmení.',80),phone:text(30).refine(v=>!v||/^\+?[\d ()-]{7,30}$/.test(v),'Zadejte platný telefon.').default('')}).strict();
// Older clients may still send SELF_EMPLOYED; always create the unified business account.
export const accountTypeInput=z.enum(['CUSTOMER','COMPANY','SELF_EMPLOYED']).transform((type):AccountType=>type==='SELF_EMPLOYED'?'COMPANY':type);
const url=z.union([z.literal(''),z.string().trim().max(2048).url().refine(v=>{try{return new URL(v).protocol==='https:';}catch{return false;}},'Použijte HTTPS adresu.')]);
const media=z.union([url,z.string().regex(/^\/api\/media\/[a-f0-9-]{36}\/$/)]);
export const businessInput=z.object({
  ico:z.string().trim().regex(/^\d{8}$/,'IČO musí obsahovat 8 číslic.'),
  businessName:required('Vyplňte název podnikání.'),address:required('Vyplňte sídlo.',500),
  billingAddress:required('Vyplňte fakturační adresu.',500),dic:text(20).default(''),website:url.default(''),
}).strict();
export const servicesInput=z.object({
  primaryServiceId:required('Vyberte hlavní obor.'),
  serviceIds:z.array(text()).min(1,'Vyberte alespoň jednu službu.').max(30).transform(v=>[...new Set(v)]),
  specializations:z.array(required('Specializace nesmí být prázdná.',100)).max(20).default([]),
}).strict();
export const areaInput=z.object({
  city:required('Vyplňte výchozí město.'),
  postalCode:text(6).refine(v=>!v||/^\d{3}\s?\d{2}$/.test(v),'PSČ má 5 číslic.').default(''),
  regions:z.array(z.string().refine(v=>CZECH_REGIONS.some(r=>r.id===v),'Neplatný kraj.')).max(14).default([]),
  cities:z.array(required('Vyplňte název města.')).max(50).default([]),
  nationwide:z.boolean().default(false),maxDistanceKm:z.number().int().min(0).max(1000),
}).strict();
export const providerInput=z.object({
  avatarUrl:media.default(''),coverUrl:media.default(''),description:text(5000).default(''),
  experience:text(3000).default(''),website:url.default(''),
  socialLinks:z.array(url.refine(v=>!!v)).max(5).default([]),
  portfolio:z.array(z.object({imageUrl:media.refine(v=>!!v),title:text(160).default('')}).strict()).max(12).default([]),
  foundedYear:z.number().int().min(1000).max(new Date().getFullYear()).nullable().default(null),
  referencesText:text(5000).default(''),
}).strict();
export type Service={id:string;parentId:string|null;name:string};
export type OnboardingData={
  personal:z.infer<typeof personalInput>;business:z.infer<typeof businessInput>;
  services:z.infer<typeof servicesInput>;area:z.infer<typeof areaInput>;profile:z.infer<typeof providerInput>;
};
export const accountAction=z.discriminatedUnion('action',[
  z.object({action:z.literal('choose'),type:accountTypeInput,newContext:z.boolean().optional()}).strict(),
  z.object({action:z.literal('switch'),accountId:z.string().min(1).max(100)}).strict(),
  z.object({action:z.literal('step'),step:z.number().int().min(1).max(5),data:z.unknown()}).strict(),
]);
