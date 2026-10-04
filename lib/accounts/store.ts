import 'server-only';
import {query} from '@/db';
import type {User} from '@/lib/auth';
import {HttpError} from '@/lib/http';
import {canManage,personalInput,businessInput,servicesInput,areaInput,providerInput,type Account,type AccountContext,type AccountType,type OnboardingData,type Service} from './model';

export function getContext(user:User):AccountContext {
  const accounts=query('SELECT a.id,a.type,a.name,a.onboarding_step AS step,a.completed_at AS completedAt,m.role FROM account_members m JOIN accounts a ON a.id=m.account_id WHERE m.user_id=? ORDER BY a.created_at,a.id',user.userId).all<Account>();
  return {accounts,account:accounts.find(a=>a.id===user.activeAccountId)??null,platformAdmin:user.platformRole==='PLATFORM_ADMIN'};
}
export function requireAccount(user:User,kind?:'customer'|'provider',complete=true):Account {
  const account=getContext(user).account;
  if(!account?.type) throw new HttpError(403,'Nejdříve vyberte typ účtu.');
  if(complete&&!account.completedAt) throw new HttpError(403,'Nejdříve dokončete nastavení Prospekto.');
  const valid=account.type==='CUSTOMER'?account.role==='CUSTOMER':account.type==='SELF_EMPLOYED'?account.role==='SELF_EMPLOYED':['COMPANY_OWNER','COMPANY_ADMIN','COMPANY_MEMBER'].includes(account.role??'');
  if(!valid) throw new HttpError(403,'Nemáte oprávnění k tomuto účtu.');
  if(kind==='customer'&&account.type!=='CUSTOMER'||kind==='provider'&&account.type==='CUSTOMER') throw new HttpError(403,'Tato funkce není dostupná pro váš typ účtu.');
  return account;
}
export function requireManager(user:User,complete=false) {
  const account=requireAccount(user,undefined,complete);
  if(!canManage(account.role)) throw new HttpError(403,'Nastavení může upravit vlastník nebo administrátor účtu.');
  return account;
}
// Caller owns the synchronous transaction; no partially created account can escape.
export function createAccount(userId:string,type:AccountType|null,name:string) {
  const id=crypto.randomUUID(),now=new Date().toISOString();
  query('INSERT INTO accounts(id,type,name,created_at) VALUES(?,?,?,?)',id,null,name,now).run();
  query('INSERT INTO account_members(account_id,user_id,created_at) VALUES(?,?,?)',id,userId,now).run();
  if(type) selectType(userId,id,type);
  return id;
}
export function selectType(userId:string,id:string,type:AccountType) {
  const current=query('SELECT a.type FROM accounts a JOIN account_members m ON m.account_id=a.id WHERE a.id=? AND m.user_id=?',id,userId).get<{type:string|null}>();
  if(!current||current.type) throw new HttpError(409,'Typ je již nastavený. Další prostředí přidejte v přepínači účtů.');
  const person=query('SELECT first_name AS firstName,last_name AS lastName,phone FROM users WHERE id=?',userId).get<{firstName:string;lastName:string;phone:string}>();
  const ready=!!person?.firstName&&!!person.lastName&&(type==='CUSTOMER'||!!person.phone);
  query('UPDATE accounts SET type=?,onboarding_step=?,completed_at=? WHERE id=?',type,ready?(type==='CUSTOMER'?5:2):1,ready&&type==='CUSTOMER'?new Date().toISOString():null,id).run();
  query('UPDATE account_members SET role=? WHERE account_id=? AND user_id=?',type==='COMPANY'?'COMPANY_OWNER':type,id,userId).run();
  if(type==='CUSTOMER') query('INSERT INTO customer_profiles(account_id) VALUES(?)',id).run();
  else {
    query('INSERT INTO provider_profiles(account_id) VALUES(?)',id).run();
    query('INSERT INTO credit_entries(id,account_id,amount,reason,idempotency_key,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(idempotency_key) DO NOTHING','demo-grant:'+id,id,100000,'DEMO_GRANT','demo-grant:'+id,new Date().toISOString()).run();
    if(type==='COMPANY') query('INSERT INTO company_profiles(account_id) VALUES(?)',id).run();
  }
}
export function catalog() {return query('SELECT id,parent_id AS parentId,name FROM services ORDER BY parent_id,name').all<Service>();}
export function onboardingData(user:User,account:Account):OnboardingData {
  const personal=query('SELECT first_name AS firstName,last_name AS lastName,phone FROM users WHERE id=?',user.userId).get<OnboardingData['personal']>()!;
  const p=query('SELECT * FROM provider_profiles WHERE account_id=?',account.id).get<Record<string,string>>();
  const area=query('SELECT city,postal_code AS postalCode,regions,cities,nationwide,max_distance_km AS maxDistanceKm FROM service_areas WHERE account_id=?',account.id).get<{city:string;postalCode:string;regions:string;cities:string;nationwide:number;maxDistanceKm:number}>();
  const company=query('SELECT founded_year AS foundedYear,references_text AS referencesText FROM company_profiles WHERE account_id=?',account.id).get<{foundedYear:number|null;referencesText:string}>();
  return {personal,business:{ico:p?.ico??'',businessName:p?.business_name??'',address:p?.address??'',billingAddress:p?.billing_address??'',dic:p?.dic??'',website:p?.website??''},
    services:{primaryServiceId:p?.primary_service_id??'',serviceIds:query('SELECT service_id FROM provider_services WHERE account_id=?',account.id).all<{service_id:string}>().map(s=>s.service_id),specializations:query('SELECT name FROM provider_specializations WHERE account_id=?',account.id).all<{name:string}>().map(s=>s.name)},
    area:area?{...area,regions:JSON.parse(area.regions),cities:JSON.parse(area.cities),nationwide:!!area.nationwide}:{city:'',postalCode:'',regions:[],cities:[],nationwide:false,maxDistanceKm:40},
    profile:{avatarUrl:p?.avatar_url??'',coverUrl:p?.cover_url??'',description:p?.description??'',experience:p?.experience??'',website:p?.website??'',socialLinks:JSON.parse(p?.social_links??'[]'),portfolio:query('SELECT image_url AS imageUrl,title FROM portfolio_items WHERE account_id=? ORDER BY position',account.id).all(),foundedYear:company?.foundedYear??null,referencesText:company?.referencesText??''}};
}
function ownedMedia(accountId:string,url:string) {
  if(!url.startsWith('/api/media/')) return;
  if(!query('SELECT id FROM media_assets WHERE id=? AND account_id=?',url.split('/')[3],accountId).get()) throw new HttpError(400,'Obrázek nepatří tomuto účtu.');
}
export function saveStep(user:User,step:number,raw:unknown) {
  const account=requireManager(user);
  if(!account.completedAt&&step>account.step) throw new HttpError(409,'Dokončete předchozí krok.');
  const id=account.id;
  if(step===1) {
    const d=personalInput.parse(raw);
    if(account.type!=='CUSTOMER'&&!d.phone) throw new HttpError(400,'Vyplňte telefon.');
    query('UPDATE users SET first_name=?,last_name=?,phone=? WHERE id=?',d.firstName,d.lastName,d.phone,user.userId).run();
    query('UPDATE profiles SET name=? WHERE id=?',d.firstName+' '+d.lastName,user.userId).run();
    if(account.type==='CUSTOMER') {
      query('UPDATE accounts SET name=?,onboarding_step=5,completed_at=COALESCE(completed_at,?) WHERE id=?',d.firstName+' '+d.lastName,new Date().toISOString(),id).run();
      return;
    }
  } else {
    if(account.type==='CUSTOMER') throw new HttpError(403,'Zákaznický účet nepotřebuje firemní údaje.');
    if(step===2) {
      const d=businessInput.parse(raw);
      // A changed IČO invalidates a previous external verification.
      query("UPDATE provider_profiles SET verification_status=CASE WHEN ico=? THEN verification_status ELSE 'UNVERIFIED' END,verified_at=CASE WHEN ico=? THEN verified_at ELSE NULL END,verification_source=CASE WHEN ico=? THEN verification_source ELSE NULL END,ico=?,business_name=?,address=?,billing_address=?,dic=?,website=? WHERE account_id=?",d.ico,d.ico,d.ico,d.ico,d.businessName,d.address,d.billingAddress,d.dic,d.website,id).run();
      query('UPDATE accounts SET name=? WHERE id=?',d.businessName,id).run();
    }
    if(step===3) {
      const d=servicesInput.parse(raw),all=catalog();
      if(!all.some(s=>s.id===d.primaryServiceId&&!s.parentId)||d.serviceIds.some(s=>!all.some(c=>c.id===s))) throw new HttpError(400,'Vyberte platné služby.');
      if(!d.serviceIds.some(s=>s===d.primaryServiceId||all.some(c=>c.id===s&&c.parentId===d.primaryServiceId))) throw new HttpError(400,'Vyberte službu z hlavního oboru.');
      query('UPDATE provider_profiles SET primary_service_id=? WHERE account_id=?',d.primaryServiceId,id).run();
      query('DELETE FROM provider_services WHERE account_id=?',id).run();
      for(const service of d.serviceIds) query('INSERT INTO provider_services VALUES(?,?)',id,service).run();
      query('DELETE FROM provider_specializations WHERE account_id=?',id).run();
      for(const name of new Set(d.specializations)) query('INSERT INTO provider_specializations VALUES(?,?)',id,name).run();
    }
    if(step===4) {
      const d=areaInput.parse(raw);
      query('INSERT INTO service_areas(account_id,city,postal_code,regions,cities,nationwide,max_distance_km) VALUES(?,?,?,?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET city=excluded.city,postal_code=excluded.postal_code,regions=excluded.regions,cities=excluded.cities,nationwide=excluded.nationwide,max_distance_km=excluded.max_distance_km,latitude=NULL,longitude=NULL',id,d.city,d.postalCode,JSON.stringify([...new Set(d.regions)]),JSON.stringify([...new Set(d.cities)]),Number(d.nationwide),d.maxDistanceKm).run();
    }
    if(step===5) {
      const d=providerInput.parse(raw);
      for(const url of [d.avatarUrl,d.coverUrl,...d.portfolio.map(p=>p.imageUrl)]) ownedMedia(id,url);
      query('UPDATE provider_profiles SET avatar_url=?,cover_url=?,description=?,experience=?,website=?,social_links=? WHERE account_id=?',d.avatarUrl,d.coverUrl,d.description,d.experience,d.website,JSON.stringify(d.socialLinks),id).run();
      if(account.type==='COMPANY') query('UPDATE company_profiles SET founded_year=?,references_text=? WHERE account_id=?',d.foundedYear,d.referencesText,id).run();
      query('DELETE FROM portfolio_items WHERE account_id=?',id).run();
      d.portfolio.forEach((p,i)=>query('INSERT INTO portfolio_items(id,account_id,image_url,title,position) VALUES(?,?,?,?,?)',crypto.randomUUID(),id,p.imageUrl,p.title,i).run());
      // Check persisted prerequisites as well as the requested step.
      const saved=onboardingData(user,account);
      businessInput.parse(saved.business);servicesInput.parse(saved.services);areaInput.parse(saved.area);
      if(!saved.personal.phone) throw new HttpError(400,'Vyplňte telefon v prvním kroku.');
      query('UPDATE accounts SET completed_at=COALESCE(completed_at,?) WHERE id=?',new Date().toISOString(),id).run();
    }
  }
  query('UPDATE accounts SET onboarding_step=MAX(onboarding_step,?) WHERE id=?',Math.min(5,step+1),id).run();
}
