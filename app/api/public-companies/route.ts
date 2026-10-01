import {getPublicCompanies} from '@/lib/companies';
import {parseCompanyFilters} from '@/lib/company-types';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{const params=new URL(request.url).searchParams;const page=await getPublicCompanies(parseCompanyFilters(params,params.get('compact')==='1'?4:20));return Response.json(page,{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}catch{ return Response.json({error:'Databázi se nepodařilo načíst. Zkuste to znovu.'},{status:503,headers:{'Cache-Control':'no-store'}});}}
