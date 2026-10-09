import {z} from 'zod';
import {CZECH_REGIONS} from '@/lib/company-types';
import {stageLabels,type Stage} from '@/lib/accounts/model';
const id=z.string().min(1).max(100),text=(min:number,max:number)=>z.string().trim().min(min).max(max);
export const cooperationLabels={ONE_OFF:'Jednorázová zakázka',LONG_TERM:'Dlouhodobá spolupráce na IČO'} as const;
export const requesterLabels={CUSTOMER:'Soukromá osoba',COMPANY:'Firma'} as const;
const cooperationType=z.enum(['ONE_OFF','LONG_TERM']);
const money=z.number().int().min(0).max(1000000000);
const mediaUrl=z.string().regex(/^\/api\/media\/[0-9a-f-]{36}\/$/i);
export const marketplaceAction=z.discriminatedUnion('action',[
 z.object({action:z.literal('request'),title:text(3,160),description:text(10,5000),serviceId:id,city:text(1,160),region:z.string().refine(v=>CZECH_REGIONS.some(r=>r.id===v)),budgetCzk:money.nullable(),cooperationType:cooperationType.default('ONE_OFF'),photos:z.array(mediaUrl).max(5).default([]).refine(urls=>new Set(urls).size===urls.length,'Fotografie se nesmí opakovat.')}).strict(),
 z.object({action:z.literal('close-request'),id}).strict(),
 z.object({action:z.literal('interest'),requestId:id}).strict(),
 z.object({action:z.literal('lead'),title:text(2,160),contactName:text(0,160),valueCzk:money}).strict(),
 z.object({action:z.literal('stage'),id,stage:z.enum(Object.keys(stageLabels) as [Stage,...Stage[]])}).strict(),
 z.object({action:z.literal('task'),title:text(2,300),dueAt:z.string().datetime().nullable()}).strict(),
 z.object({action:z.literal('task-done'),id,done:z.boolean()}).strict(),
 z.object({action:z.literal('offer'),requestId:id,body:text(5,5000),amountCzk:money}).strict(),
 z.object({action:z.literal('accept-offer'),id}).strict(),
 z.object({action:z.literal('unlock-chat'),id}).strict(),
 z.object({action:z.literal('message'),requestId:id,providerId:id,body:text(1,5000)}).strict(),
 z.object({action:z.literal('review'),requestId:id,rating:z.number().int().min(1).max(5),body:text(3,3000)}).strict(),
 z.object({action:z.literal('favorite'),providerId:id,enabled:z.boolean()}).strict(),
]);
export type MarketRequest={requesterId:string;requesterType:keyof typeof requesterLabels;cooperationType:keyof typeof cooperationLabels;id:string;title:string;description:string;serviceId:string;city:string;region:string;status:string;budgetCzk:number|null;createdAt:string;photos:string[]};
export type Lead={id:string;requestId:string|null;title:string;contactName:string;stage:Stage;valueCzk:number;createdAt:string;updatedAt:string};
export type Task={id:string;title:string;dueAt:string|null;done:number};
export type Offer={chatUnlocked:boolean;id:string;requestId:string;providerId:string;providerName:string;requestTitle:string;body:string;amountCzk:number;status:string};
export type Message={id:string};
export type Provider={id:string;name:string;description:string;city:string;avatarUrl:string;website:string;favorite:number;serviceNames:string};
export type ProviderProfile={id:string;name:string;description:string;experience:string;city:string;maxDistanceKm:number;avatarUrl:string;coverUrl:string;ico:string;foundedYear:number|null;website:string;socialLinks:string[];services:string[];portfolio:{imageUrl:string;title:string}[];referencesText:string;reviews:{id:string;rating:number;body:string}[]};
export type Review={id:string;requestId:string;rating:number;body:string;providerName:string};
export type MarketplaceState={credits:number;summary:{newLeads:number;activeLeads:number;offers:number;won:number;pipelineValue:number};ownRequests:MarketRequest[];receivedOffers:Offer[];givenReviews:Review[];requests:MarketRequest[];leads:Lead[];tasks:Task[];offers:Offer[];messages:Message[];providers:Provider[];reviews:Review[]};


export type RequestFeed={items:MarketRequest[];total:number;page:number;pages:number};
