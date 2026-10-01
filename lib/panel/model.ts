import { z } from 'zod';

export const profileInput = z.object({name:z.string().trim().min(2,'Zadejte alespoň 2 znaky.').max(80),workspace:z.string().trim().min(2).max(80)}).strict();
const companyIds=z.array(z.string().regex(/^(?:demo-\d{1,2}|zf:\d{1,12})$/)).min(1,'Vyberte alespoň jednu firmu.').max(500,'Do jednoho seznamu nebo kampaně vyberte nejvýše 500 firem.').transform(v=>[...new Set(v)]);
export const campaignInput=z.object({id:z.string().uuid().optional(),name:z.string().trim().min(2).max(120),purpose:z.string().trim().min(2).max(500),subject:z.string().trim().min(2).max(200).refine(v=>!/[\r\n]/.test(v),'Předmět nesmí obsahovat nové řádky.'),body:z.string().trim().min(5).max(12000),companyIds}).strict();
export const settingsInput=z.object({host:z.string().trim().max(253).regex(/^[a-zA-Z0-9.-]*$/),port:z.number().int().min(1).max(65535),tls:z.enum(['STARTTLS','TLS']),username:z.string().trim().max(254),senderName:z.string().trim().max(100),senderEmail:z.union([z.literal(''),z.string().email().max(254)]),replyTo:z.union([z.literal(''),z.string().email().max(254)]),signature:z.string().max(2000),interval:z.number().int().min(1).max(86400),hourly:z.number().int().min(1).max(10000),daily:z.number().int().min(1).max(100000),workers:z.number().int().min(1).max(8)}).strict().refine(v=>v.hourly<=v.daily,'Hodinový limit nesmí být vyšší než denní.');
export type BotSettings=z.infer<typeof settingsInput>;
export const defaultSettings:BotSettings={host:'',port:587,tls:'STARTTLS',username:'',senderName:'',senderEmail:'',replyTo:'',signature:'',interval:120,hourly:30,daily:200,workers:1};
export type Profile={id:string;name:string;workspace:string;email:string;createdAt:string};
export type SavedList={id:string;name:string;companyIds:string[];updatedAt:string};
export type Campaign=z.infer<typeof campaignInput>&{id:string;updatedAt:string};
export type Suppression={id:string;email:string;reason:string;createdAt:string};
export type PanelState={profile:Profile;lists:SavedList[];campaigns:Campaign[];settings:BotSettings;suppressions:Suppression[]};
export const actionInput=z.discriminatedUnion('action',[
 z.object({action:z.literal('register'),data:profileInput}).strict(),
 z.object({action:z.literal('profile'),data:profileInput}).strict(),
 z.object({action:z.literal('save-list'),data:z.object({name:z.string().trim().min(2).max(100),companyIds}).strict()}).strict(),
 z.object({action:z.literal('delete-list'),id:z.string().uuid()}).strict(),
 z.object({action:z.literal('save-campaign'),data:campaignInput}).strict(),
 z.object({action:z.literal('delete-campaign'),id:z.string().uuid()}).strict(),
 z.object({action:z.literal('settings'),data:settingsInput}).strict(),
 z.object({action:z.literal('suppress'),data:z.object({email:z.string().trim().email().max(254).transform(v=>v.toLowerCase()),reason:z.string().trim().min(2).max(300)}).strict()}).strict(),
 z.object({action:z.literal('unsuppress'),id:z.string().uuid()}).strict(),
]);
export type PanelAction=z.infer<typeof actionInput>;
export const templateKeys=['nazev_firmy','ico','kategorie','web','email'] as const;
export function unknownVariables(value:string){return [...new Set([...value.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)].map(v=>v[1]).filter(v=>!templateKeys.includes(v as typeof templateKeys[number])))];}
export function renderTemplate(value:string,company:{name:string;ico:string;industry:string;website:string;email:string}){const data:Record<string,string>={nazev_firmy:company.name,ico:company.ico,kategorie:company.industry,web:company.website,email:company.email};return value.replace(/\{\{\s*([^{}]+?)\s*\}\}/g,(_,key:string)=>data[key]??`{{${key}}}`);}
