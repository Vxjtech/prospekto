import { env } from 'cloudflare:workers';
import type { ChatGPTUser } from '@/app/chatgpt-auth';
import { defaultSettings, settingsInput, type Profile, type PanelState, type PanelAction, type SavedList, type Campaign, type Suppression } from './model';
import { getCompaniesByIds } from '@/lib/companies';

function db(){if(!env.DB)throw new Error('DB unavailable');return env.DB;}
export class PanelError extends Error{constructor(public status:number,message:string){super(message);}}
export async function getProfile(user:ChatGPTUser):Promise<Profile|null>{const row=await db().prepare('SELECT id, name, workspace, created_at AS createdAt FROM profiles WHERE id = ?').bind(user.userId).first<Omit<Profile,'email'>>();return row?{...row,email:user.email}:null;}
export async function getPanelState(user:ChatGPTUser,profile:Profile):Promise<PanelState>{
 const [lists,campaigns,settings,suppressions]=await Promise.all([
 db().prepare('SELECT id, name, company_ids AS companyIds, updated_at AS updatedAt FROM saved_lists WHERE owner_id = ? ORDER BY updated_at DESC').bind(user.userId).all<Omit<SavedList,'companyIds'>&{companyIds:string}>(),
 db().prepare('SELECT id, name, purpose, subject, body, company_ids AS companyIds, updated_at AS updatedAt FROM campaigns WHERE owner_id = ? ORDER BY updated_at DESC').bind(user.userId).all<Omit<Campaign,'companyIds'>&{companyIds:string}>(),
 db().prepare('SELECT settings FROM bot_settings WHERE owner_id = ?').bind(user.userId).first<{settings:string}>(),
 db().prepare('SELECT id, email, reason, created_at AS createdAt FROM suppressions WHERE owner_id = ? ORDER BY created_at DESC').bind(user.userId).all<Suppression>()]);
 return {profile,lists:lists.results.map(v=>({...v,companyIds:JSON.parse(v.companyIds)})),campaigns:campaigns.results.map(v=>({...v,companyIds:JSON.parse(v.companyIds)})),settings:settings?settingsInput.parse(JSON.parse(settings.settings)):{...defaultSettings},suppressions:suppressions.results};
}
async function ensureCapacity(table:'saved_lists'|'campaigns'|'suppressions',owner:string){const row=await db().prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE owner_id = ?`).bind(owner).first<{count:number}>();if((row?.count??0)>=200)throw new PanelError(409,'Dosáhli jste limitu 200 položek. Nejprve některé odstraňte.');}
export async function applyAction(user:ChatGPTUser,input:PanelAction){
 const owner=user.userId,now=new Date().toISOString();
 if(input.action==='register'){await db().prepare('INSERT INTO profiles (id, name, workspace, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING').bind(owner,input.data.name,input.data.workspace,now).run();return;}
 const profile=await getProfile(user);if(!profile)throw new PanelError(403,'Nejdřív dokončete registraci.');
 if('data' in input&&'companyIds' in input.data&&(await getCompaniesByIds(input.data.companyIds)).length!==input.data.companyIds.length)throw new PanelError(400,'Výběr obsahuje neplatnou firmu.');
 switch(input.action){
 case 'profile':await db().prepare('UPDATE profiles SET name = ?, workspace = ? WHERE id = ?').bind(input.data.name,input.data.workspace,owner).run();break;
 case 'save-list':await ensureCapacity('saved_lists',owner);await db().prepare('INSERT INTO saved_lists (id, owner_id, name, company_ids, updated_at) VALUES (?, ?, ?, ?, ?)').bind(crypto.randomUUID(),owner,input.data.name,JSON.stringify(input.data.companyIds),now).run();break;
 case 'delete-list':await db().prepare('DELETE FROM saved_lists WHERE id = ? AND owner_id = ?').bind(input.id,owner).run();break;
 case 'save-campaign':{const d=input.data;if(d.id){const r=await db().prepare('UPDATE campaigns SET name = ?, purpose = ?, subject = ?, body = ?, company_ids = ?, updated_at = ? WHERE id = ? AND owner_id = ?').bind(d.name,d.purpose,d.subject,d.body,JSON.stringify(d.companyIds),now,d.id,owner).run();if(!r.meta.changes)throw new PanelError(404,'Koncept nebyl nalezen.');}else{await ensureCapacity('campaigns',owner);await db().prepare('INSERT INTO campaigns (id, owner_id, name, purpose, subject, body, company_ids, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(),owner,d.name,d.purpose,d.subject,d.body,JSON.stringify(d.companyIds),now).run();}break;}
 case 'delete-campaign':await db().prepare('DELETE FROM campaigns WHERE id = ? AND owner_id = ?').bind(input.id,owner).run();break;
 case 'settings':await db().prepare('INSERT INTO bot_settings (owner_id, settings, updated_at) VALUES (?, ?, ?) ON CONFLICT(owner_id) DO UPDATE SET settings = excluded.settings, updated_at = excluded.updated_at').bind(owner,JSON.stringify(input.data),now).run();break;
 case 'suppress':await ensureCapacity('suppressions',owner);await db().prepare('INSERT INTO suppressions (id, owner_id, email, reason, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(owner_id, email) DO UPDATE SET reason = excluded.reason').bind(crypto.randomUUID(),owner,input.data.email,input.data.reason,now).run();break;
 case 'unsuppress':await db().prepare('DELETE FROM suppressions WHERE id = ? AND owner_id = ?').bind(input.id,owner).run();break;
 }
}
