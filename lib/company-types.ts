export const COMPANY_CATEGORIES=[
 {id:'auto-moto',label:'Auto, moto'},
 {id:'reality',label:'Reality'},
 {id:'sluzby-obchod-prodej',label:'Služby, obchod, prodej'},
 {id:'urady-sprava',label:'Úřady, správa'},
 {id:'vzdelani-jazyky',label:'Vzdělání, jazyky'},
 {id:'zahrada-zemedelstvi-zvirata',label:'Zahrada, zemědělství, zvířata'},
 {id:'finance-ekonomika-pravo',label:'Finance, ekonomika, právo'},
 {id:'restaurace-ubytovani',label:'Restaurace, ubytování'},
 {id:'stavebnictvi',label:'Stavebnictví'},
 {id:'vypocetni-technika-internet',label:'Výpočetní technika, internet'},
 {id:'zabava-kultura',label:'Zábava, kultura'},
 {id:'zdravotnictvi',label:'Zdravotnictví, zdravotní služby a technika'},
] as const;

export const CZECH_REGIONS=[
 {id:'praha',label:'Hlavní město Praha'},
 {id:'stredocesky',label:'Středočeský kraj'},
 {id:'jihocesky',label:'Jihočeský kraj'},
 {id:'plzensky',label:'Plzeňský kraj'},
 {id:'karlovarsky',label:'Karlovarský kraj'},
 {id:'ustecky',label:'Ústecký kraj'},
 {id:'liberecky',label:'Liberecký kraj'},
 {id:'kralovehradecky',label:'Královéhradecký kraj'},
 {id:'pardubicky',label:'Pardubický kraj'},
 {id:'vysocina',label:'Kraj Vysočina'},
 {id:'jihomoravsky',label:'Jihomoravský kraj'},
 {id:'olomoucky',label:'Olomoucký kraj'},
 {id:'zlinsky',label:'Zlínský kraj'},
 {id:'moravskoslezsky',label:'Moravskoslezský kraj'},
] as const;

export type CategoryId=typeof COMPANY_CATEGORIES[number]['id'];
export type RegionId=typeof CZECH_REGIONS[number]['id'];
export type Company={id:string;name:string;city:string;industry:string;category:CategoryId;region:RegionId|'';categories?:CategoryId[];phones?:string[];emails?:string[];websites?:string[];ico:string;phone:string;email:string;website:string};
export type PublicCompany=Pick<Company,'id'|'name'|'category'|'region'>;
export function categoryLabel(id:string){return COMPANY_CATEGORIES.find(item=>item.id===id)?.label??'';}
export function regionLabel(id:string){return CZECH_REGIONS.find(item=>item.id===id)?.label??'';}
export function normalizeSearch(value:string){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('cs').trim();}
export function filterCompanies<T extends PublicCompany>(data:T[],query:string,category:string,region:string):T[]{
 const words=normalizeSearch(query).split(/\s+/).filter(Boolean);
 return data.filter(company=>(!category||company.category===category)&&(!region||company.region===region)&&words.every(word=>normalizeSearch(`${company.name} ${'ico' in company?company.ico:''} ${'city' in company?company.city:''} ${'industry' in company?company.industry:''}`).includes(word)));
}

export type CompanyFilters={query:string;category:string;region:string;page:number;pageSize:number;ids?:string[]};
export type CompanyPage<T extends PublicCompany=PublicCompany>={items:T[];total:number;withEmail:number;page:number;pageSize:number;pageCount:number;catalogTotal:number;ready:boolean;regionsAvailable:boolean};
export function parseCompanyFilters(params:URLSearchParams,pageSize=20):CompanyFilters{return {query:(params.get('q')??'').slice(0,200),category:COMPANY_CATEGORIES.find(c=>c.id===params.get('kategorie'))?.id??'',region:CZECH_REGIONS.find(r=>r.id===params.get('kraj'))?.id??'',page:Math.max(1,Math.min(100000,Number.parseInt(params.get('strana')??'1',10)||1)),pageSize};}
export function companyQuery(filters:CompanyFilters){const p=new URLSearchParams();if(filters.query)p.set('q',filters.query);if(filters.category)p.set('kategorie',filters.category);if(filters.region)p.set('kraj',filters.region);if(filters.page>1)p.set('strana',String(filters.page));return p;}
export function paginationPages(current:number,count:number):(number|'gap')[]{const values=[...new Set([1,current-1,current,current+1,count])].filter(n=>n>=1&&n<=count).sort((a,b)=>a-b);const out:(number|'gap')[]=[];for(const n of values){const previous=out.at(-1);if(typeof previous==='number'&&n-previous>1)out.push('gap');out.push(n);}return out;}
