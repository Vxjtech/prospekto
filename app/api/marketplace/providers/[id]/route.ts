import {getUser} from '@/lib/auth';
import {query} from '@/db';
import {HttpError,json} from '@/lib/http';
import {requireAccount} from '@/lib/accounts/store';
import type {ProviderProfile} from '@/lib/marketplace/model';
export const dynamic='force-dynamic';

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
  try {
    const user=await getUser();
    if(!user)throw new HttpError(401,'Přihlaste se.');
    requireAccount(user);
    const {id}=await params;
    const provider=query(
      "SELECT a.id,a.name,p.description,p.experience,p.avatar_url AS avatarUrl,p.cover_url AS coverUrl,p.ico,p.website,p.social_links AS socialLinks,COALESCE(s.city,'') AS city,COALESCE(s.max_distance_km,0) AS maxDistanceKm,c.founded_year AS foundedYear,c.references_text AS referencesText FROM accounts a JOIN provider_profiles p ON p.account_id=a.id LEFT JOIN service_areas s ON s.account_id=a.id LEFT JOIN company_profiles c ON c.account_id=a.id WHERE a.id=? AND a.completed_at IS NOT NULL",
      id,
    ).get<Omit<ProviderProfile,'services'|'portfolio'|'reviews'>&{socialLinks:string;referencesText:string|null}>();
    if(!provider)throw new HttpError(404,'Profil dodavatele nebyl nalezen.');
    const result:ProviderProfile={
      ...provider,
      socialLinks:JSON.parse(provider.socialLinks) as string[],
      referencesText:provider.referencesText??'',
      services:query('SELECT s.name FROM services s JOIN provider_services ps ON ps.service_id=s.id WHERE ps.account_id=? ORDER BY s.name',id).all<{name:string}>().map(s=>s.name),
      portfolio:query('SELECT image_url AS imageUrl,title FROM portfolio_items WHERE account_id=? ORDER BY position',id).all<{imageUrl:string;title:string}>(),
      reviews:query('SELECT id,rating,body FROM reviews WHERE provider_account_id=? ORDER BY created_at DESC LIMIT 20',id).all<{id:string;rating:number;body:string}>(),
    };
    return json({profile:result});
  } catch(error) {
    if(error instanceof HttpError)return json({error:error.message},error.status);
    console.error('Provider profile could not be loaded',error instanceof Error?error.name:'unknown');
    return json({error:'Profil dodavatele se nepodařilo načíst. Zkuste to znovu.'},503);
  }
}
