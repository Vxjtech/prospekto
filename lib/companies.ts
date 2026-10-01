import 'server-only';
import {env} from 'cloudflare:workers';
import {companies as demoCompanies} from './demo-companies';
import {categoryLabel,filterCompanies,normalizeSearch,type Company,type PublicCompany,type CompanyFilters,type CompanyPage,type CategoryId,type RegionId} from './company-types';

export function catalogDb(){if(!env.DB)throw new Error('Catalog database unavailable');return env.DB;}
type CatalogRow={id:string;name:string;ico:string;phones:string;emails:string;websites:string;categories:string;city:string;region:RegionId|''};
type Meta={ready:number;total:number;with_email:number;regions_available:number};
function publicRecord(row:Pick<CatalogRow,'id'|'name'|'categories'|'region'>):PublicCompany{return {id:row.id,name:row.name,category:(JSON.parse(row.categories) as CategoryId[])[0],region:row.region};}
function fullRecord(row:CatalogRow):Company{const categories=JSON.parse(row.categories) as CategoryId[],phones=JSON.parse(row.phones) as string[],emails=JSON.parse(row.emails) as string[],websites=JSON.parse(row.websites) as string[];return {...publicRecord(row),city:row.city,industry:categories.map(categoryLabel).join(' · '),ico:row.ico,phone:phones[0]??'',email:emails[0]??'',website:websites[0]??'',categories,phones,emails,websites};}
const publicColumns='c.id,c.name,c.categories,c.region';
const privateColumns=publicColumns+',c.city,c.ico,c.phones,c.emails,c.websites';
export async function getCatalogMeta(){return await catalogDb().prepare("SELECT ready,total,with_email,regions_available FROM catalog_meta WHERE id='kontakty-2026-10-01'").first<Meta>();}
async function queryCatalog(filters:CompanyFilters,full:boolean):Promise<CompanyPage<Company|PublicCompany>>{
 const db=catalogDb(),meta=await getCatalogMeta();
 if(!meta?.ready||(filters.ids?.length&&filters.ids.every(id=>id.startsWith('demo-')))){
  const source=filters.ids?demoCompanies.filter(c=>filters.ids!.includes(c.id)):demoCompanies;
  const matches=filterCompanies(source,filters.query,filters.category,filters.region),pageSize=filters.pageSize,pageCount=Math.max(1,Math.ceil(matches.length/pageSize)),page=Math.min(filters.page,pageCount);
  return {items:matches.slice((page-1)*pageSize,page*pageSize).map(c=>full?c:{id:c.id,name:c.name,category:c.category,region:c.region}),total:matches.length,withEmail:matches.filter(c=>c.email).length,page,pageSize,pageCount,catalogTotal:meta?.ready?meta.total:demoCompanies.length,ready:!!meta?.ready,regionsAvailable:!meta?.ready};
 }
 const conditions:string[]=[],bindings:(string|number)[]=[];
 if(filters.category){conditions.push('c.id IN (SELECT company_id FROM catalog_categories WHERE category=?)');bindings.push(filters.category);}
 if(filters.region){conditions.push('c.region=?');bindings.push(filters.region);}
 if(filters.ids){conditions.push('c.id IN (SELECT value FROM json_each(?))');bindings.push(JSON.stringify(filters.ids));}
 const words=normalizeSearch(filters.query).match(/[\p{L}\p{N}]+/gu)?.slice(0,10)??[];
 if(words.length){conditions.push('c.rowid IN (SELECT rowid FROM catalog_search WHERE catalog_search MATCH ?)');bindings.push(words.map(word=>'"'+word+'"*').join(' AND '));}
 const where=conditions.length?' WHERE '+conditions.join(' AND '):'';
 const counts=conditions.length?await db.prepare("SELECT count(*) AS total,coalesce(sum(c.emails!='[]'),0) AS with_email FROM catalog_companies c"+where).bind(...bindings).first<{total:number;with_email:number}>():meta;
 const total=counts?.total??0,pageSize=filters.pageSize,pageCount=Math.max(1,Math.ceil(total/pageSize)),page=Math.min(filters.page,pageCount);
 const rows=await db.prepare(`SELECT ${full?privateColumns:publicColumns} FROM catalog_companies c${where} ORDER BY c.sort_name,c.id LIMIT ? OFFSET ?`).bind(...bindings,pageSize,(page-1)*pageSize).all<CatalogRow>();
 return {items:rows.results.map(full?fullRecord:publicRecord),total,withEmail:counts?.with_email??0,page,pageSize,pageCount,catalogTotal:meta.total,ready:true,regionsAvailable:!!meta.regions_available};
}
export async function getPublicCompanies(filters:CompanyFilters={query:'',category:'',region:'',page:1,pageSize:4}){return await queryCatalog(filters,false) as CompanyPage<PublicCompany>;}
export async function getPrivateCompanies(filters:CompanyFilters){return await queryCatalog(filters,true) as CompanyPage<Company>;}
export async function getCompaniesByIds(ids:string[]):Promise<Company[]>{
 if(!ids.length)return [];if(ids.length>500)throw new Error('Too many company IDs');
 const legacy=demoCompanies.filter(c=>ids.includes(c.id));
 const rows=await catalogDb().prepare(`SELECT ${privateColumns} FROM catalog_companies c WHERE c.id IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(ids)).all<CatalogRow>();
 return [...rows.results.map(fullRecord),...legacy];
}
