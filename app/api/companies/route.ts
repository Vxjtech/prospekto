import {getUser} from '@/lib/auth';
import {query} from '@/db';
import {getProfile} from '@/lib/panel/store';
import {getPrivateCompanies,getCompaniesByIds} from '@/lib/companies';
import {parseCompanyFilters} from '@/lib/company-types';
export const dynamic='force-dynamic';
function json(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});}
export async function GET(request:Request){try{
 const user=await getUser();if(!user)return json({error:'Přihlaste se pro zobrazení kontaktů.'},401);if(!await getProfile(user))return json({error:'Dokončete registraci.'},403);
 const params=new URL(request.url).searchParams;
 if(params.has('ids')){const ids=[...new Set((params.get('ids')??'').split(',').filter(Boolean))];if(ids.length>500||ids.some(id=>! /^(demo-\d{1,2})$/.test(id)))return json({error:'Neplatný výběr firem.'},400);return json({items:await getCompaniesByIds(ids)});}
 const filters=parseCompanyFilters(params,20);
 if(params.has('list')){const list=await query('SELECT company_ids FROM saved_lists WHERE id=? AND owner_id=?',params.get('list'),user.userId).get<{company_ids:string}>();if(!list)return json({error:'Seznam nebyl nalezen.'},404);filters.ids=JSON.parse(list.company_ids);}
 return json(await getPrivateCompanies(filters));
 }catch{return json({error:'Databázi se nepodařilo načíst. Zkuste to znovu.'},503);}}
