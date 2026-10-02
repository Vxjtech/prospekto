import {query} from '@/db';
import type {User} from '@/lib/auth';
import { defaultSettings, settingsInput, type Profile, type PanelState, type PanelAction, type SavedList, type Campaign, type Suppression } from './model';
import { areCompanyIdsValid } from '@/lib/companies';

export class PanelError extends Error{constructor(public status:number,message:string){super(message);}}
export async function getProfile(user:User):Promise<Profile|null>{const row=await query('SELECT id, name, workspace, created_at AS createdAt FROM profiles WHERE id = ?', user.userId).get<Omit<Profile,'email'>>();return row?{...row,email:user.email}:null;}
export async function getPanelState(user:User,profile:Profile):Promise<PanelState>{
 const [lists,campaigns,settings,suppressions]=await Promise.all([
 query('SELECT id, name, company_ids AS companyIds, updated_at AS updatedAt FROM saved_lists WHERE owner_id = ? ORDER BY updated_at DESC', user.userId).all<Omit<SavedList,'companyIds'>&{companyIds:string}>(),
 query('SELECT id, name, purpose, subject, body, company_ids AS companyIds, updated_at AS updatedAt FROM campaigns WHERE owner_id = ? ORDER BY updated_at DESC', user.userId).all<Omit<Campaign,'companyIds'>&{companyIds:string}>(),
 query('SELECT settings FROM bot_settings WHERE owner_id = ?', user.userId).get<{settings:string}>(),
 query('SELECT id, email, reason, created_at AS createdAt FROM suppressions WHERE owner_id = ? ORDER BY created_at DESC', user.userId).all<Suppression>()]);
 return {profile,lists:lists.map(v=>({...v,companyIds:JSON.parse(v.companyIds)})),campaigns:campaigns.map(v=>({...v,companyIds:JSON.parse(v.companyIds)})),settings:settings?settingsInput.parse(JSON.parse(settings.settings)):{...defaultSettings},suppressions};
}
async function ensureCapacity(table:'saved_lists'|'campaigns'|'suppressions',owner:string){const row=await query(`SELECT COUNT(*) AS count FROM ${table} WHERE owner_id = ?`, owner).get<{count:number}>();if((row?.count??0)>=200)throw new PanelError(409,'Dosáhli jste limitu 200 položek. Nejprve některé odstraňte.');}
export async function applyAction(user:User,input:PanelAction){
 const owner=user.userId,now=new Date().toISOString();
 const profile=await getProfile(user);if(!profile)throw new PanelError(403,'Nejdřív dokončete registraci.');
 if('data' in input&&'companyIds' in input.data&&!areCompanyIdsValid(input.data.companyIds))throw new PanelError(400,'Výběr obsahuje neplatnou firmu.');
 switch(input.action){
 case 'profile':await query('UPDATE profiles SET name = ?, workspace = ? WHERE id = ?', input.data.name,input.data.workspace,owner).run();break;
 case 'save-list':await ensureCapacity('saved_lists',owner);await query('INSERT INTO saved_lists (id, owner_id, name, company_ids, updated_at) VALUES (?, ?, ?, ?, ?)', crypto.randomUUID(),owner,input.data.name,JSON.stringify(input.data.companyIds),now).run();break;
 case 'delete-list':await query('DELETE FROM saved_lists WHERE id = ? AND owner_id = ?', input.id,owner).run();break;
 case 'save-campaign':{const d=input.data;if(d.id){const r=await query('UPDATE campaigns SET name = ?, purpose = ?, subject = ?, body = ?, company_ids = ?, updated_at = ? WHERE id = ? AND owner_id = ?', d.name,d.purpose,d.subject,d.body,JSON.stringify(d.companyIds),now,d.id,owner).run();if(!r.changes)throw new PanelError(404,'Koncept nebyl nalezen.');}else{await ensureCapacity('campaigns',owner);await query('INSERT INTO campaigns (id, owner_id, name, purpose, subject, body, company_ids, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', crypto.randomUUID(),owner,d.name,d.purpose,d.subject,d.body,JSON.stringify(d.companyIds),now).run();}break;}
 case 'delete-campaign':await query('DELETE FROM campaigns WHERE id = ? AND owner_id = ?', input.id,owner).run();break;
 case 'settings':await query('INSERT INTO bot_settings (owner_id, settings, updated_at) VALUES (?, ?, ?) ON CONFLICT(owner_id) DO UPDATE SET settings = excluded.settings, updated_at = excluded.updated_at', owner,JSON.stringify(input.data),now).run();break;
 case 'suppress':await ensureCapacity('suppressions',owner);await query('INSERT INTO suppressions (id, owner_id, email, reason, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(owner_id, email) DO UPDATE SET reason = excluded.reason', crypto.randomUUID(),owner,input.data.email,input.data.reason,now).run();break;
 case 'unsuppress':await query('DELETE FROM suppressions WHERE id = ? AND owner_id = ?', input.id,owner).run();break;
 }
}
