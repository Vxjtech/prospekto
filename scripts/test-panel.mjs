/** Integration checks against the production Worker and an isolated local D1.
 * Identity headers simulate the trusted Sites dispatcher in this test only.
 * This is not a development sign-in or a deployed authentication bypass.
 */
import {createRequire} from 'node:module';
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const wranglerRequire=createRequire(require.resolve('wrangler/package.json'));
const {Miniflare}=wranglerRequire('miniflare');
const files=(await readdir('dist/server',{recursive:true})).filter(p=>/\.m?js$/.test(p)&&p!=='index.js');
const modules=['index.js',...files].map(path=>({type:'ESModule',path:resolve('dist/server',path)}));
const mf=new Miniflare({modules,modulesRoot:resolve('dist/server'),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],assets:{directory:'dist/client',binding:'ASSETS',routerConfig:{has_user_worker:true}},cf:false,bindings:{CATALOG_IMPORT_TOKEN:'local-import-test-token'}});
const origin='https://prospekto.test';
let checked=0;
function check(condition,message){assert.ok(condition,message);checked++;console.log(`PASS ${message}`);}
async function request(path,who,body,originHeader=origin,extraHeaders={}){const headers={...extraHeaders};if(who){headers['oai-authenticated-user-id']=`test-${who}`;headers['oai-authenticated-user-email']=`${who}@example.test`;}if(body!==undefined){headers['content-type']='application/json';headers.origin=originHeader;}return mf.dispatchFetch(origin+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'});}
async function action(who,body){const res=await request('/api/panel/',who,body);const data=await res.json();assert.equal(res.status,200,JSON.stringify(data));return data.state;}
try{
 const db=await mf.getD1Database('DB');for(const file of (await readdir('drizzle')).filter(name=>name.endsWith('.sql')).sort()){const sql=await readFile('drizzle/'+file,'utf8');for(const statement of sql.split('--> statement-breakpoint').filter(s=>s.trim()))await db.prepare(statement).run();}
 let r=await request('/api/panel/');check(r.status===401,'anonymous API access is rejected');
 r=await request('/api/panel/',null,{action:'register',data:{name:'Anonymous',workspace:'No'}});check(r.status===401,'anonymous registration write is rejected');
 r=await request('/panel/');check([302,303,307,308].includes(r.status)&&r.headers.get('location')?.includes('/registrace'),'anonymous panel access redirects to registration');
 r=await request('/api/panel/','alice');check(r.status===403,'signed-in user without profile cannot read the panel');
 r=await request('/panel/','alice');check([302,303,307,308].includes(r.status)&&r.headers.get('location')?.includes('/registrace'),'registration must be completed before panel access');
 r=await request('/registrace/');let html=await r.text();check(r.status===200&&html.includes('/signin-with-chatgpt?return_to='),'public registration starts platform-owned sign-in');
 r=await request('/registrace/','alice');html=await r.text();check(r.status===200&&html.includes('Dokončit registraci'),'authenticated new visitor gets registration form');
 let state=await action('alice',{action:'register',data:{name:'Alice Test',workspace:'Alice firma'}});check(state.profile.name==='Alice Test','registration creates a persistent profile');
 await action('alice',{action:'register',data:{name:'Changed Name',workspace:'Changed Company'}});state=(await (await request('/api/panel/','alice')).json()).state;check(state.profile.name==='Alice Test','repeated registration is idempotent');
 r=await request('/api/panel/','alice',{action:'profile',data:{name:'Forged change',workspace:'No'}},'https://untrusted.test');check(r.status===403,'cross-origin writes are rejected');
 r=await request('/api/panel/','alice',{action:'profile',data:{name:'Forged change',workspace:'No'},ownerId:'test-bob'});check(r.status===400,'client-supplied owner IDs are rejected');
 state=await action('alice',{action:'save-list',data:{name:'Výroba Praha',companyIds:['demo-1','demo-1','demo-2']}});const listId=state.lists[0].id;check(state.lists[0].companyIds.length===2,'saved lists deduplicate selected contacts');
 state=await action('alice',{action:'save-campaign',data:{name:'První nabídka',purpose:'Spolupráce',subject:'Dobrý den {{nazev_firmy}}',body:'Dobrý den, nabízíme vám spolupráci.',companyIds:['demo-1']}});const campaignId=state.campaigns[0].id;check(!!campaignId,'campaign draft is saved');
 const settings={...state.settings,host:'smtp.example.test',senderEmail:'alice@example.test',senderName:'Alice',signature:'Alice s.r.o.'};state=await action('alice',{action:'settings',data:settings});check(state.settings.host===settings.host,'bot configuration is persisted');
 r=await request('/api/panel/','alice',{action:'settings',data:{...settings,password:'must-not-be-stored'}});check(r.status===400,'SMTP secrets cannot be stored in plain settings');
 state=await action('alice',{action:'suppress',data:{email:'INFO@FIRMA-A.EXAMPLE',reason:'Žádost o odhlášení'}});check(state.suppressions[0].email==='info@firma-a.example','suppression address is normalized');
 state=await action('bob',{action:'register',data:{name:'Bob Test',workspace:'Bob firma'}});check(state.lists.length===0&&state.campaigns.length===0&&state.suppressions.length===0&&state.settings.host==='','second user sees only their own data');
 await action('bob',{action:'delete-list',id:listId});r=await request('/api/panel/','bob',{action:'save-campaign',data:{id:campaignId,name:'Unauthorized edit',purpose:'Edit',subject:'Unauthorized',body:'Unauthorized edit attempt',companyIds:['demo-1']}});check(r.status===404,'other user cannot edit a campaign');
 await action('bob',{action:'delete-campaign',id:campaignId});state=(await (await request('/api/panel/','alice')).json()).state;check(state.lists.length===1&&state.campaigns[0].id===campaignId,'other user cannot delete owned lists or campaigns');
 r=await request('/api/panel/','alice');check(r.headers.get('cache-control')?.includes('no-store'),'private API data is not cacheable');
 const protectedData={companies:(await (await request('/api/companies/?ids='+Array.from({length:32},(_,i)=>'demo-'+(i+1)).join(','),'alice')).json()).items};check(protectedData.companies.every(c=>c.email&&c.phone&&c.website),'registered users retain full contacts');
 function hasContact(text){return protectedData.companies.some(c=>[c.email,c.phone,c.website,c.ico].some(value=>text.includes(value)))||/info@firma-|\+420 000 000/.test(text);}
 for(const path of ['/','/databaze/']){const publicResponse=await request(path);const publicHtml=await publicResponse.text();check(publicResponse.status===200&&publicHtml.includes('Vzorová výroba s.r.o.'),`${path} displays company names anonymously`);check(!hasContact(publicHtml),`${path} contains no contact data in HTML or hydration payload`);}
 r=await request('/databaze/?_rsc',null,undefined,origin,{RSC:'1'});const rsc=await r.text();check(r.status===200&&r.headers.get('content-type')?.includes('text/x-component')&&!hasContact(rsc),'anonymous RSC payload exposes no contact details');
 const clientFiles=(await readdir('dist/client',{recursive:true})).filter(name=>/\.(?:js|map)$/.test(name));let safeClient=true;for(const file of clientFiles){if(hasContact(await readFile(resolve('dist/client',file),'utf8')))safeClient=false;}check(safeClient,'public JavaScript bundles contain no contact records');
 r=await request('/panel/','alice');html=await r.text();check(r.status===200&&html.includes('Alice firma')&&html.includes('Najděte své další klienty.'),'registered panel renders the real dashboard');check(r.headers.get('cache-control')?.includes('no-store'),'private panel HTML is not cacheable');
 r=await request('/');html=await r.text();check(r.status===200&&html.includes('UŽ JSOU TADY.')&&html.includes('/registrace/'),'landing remains public with registration entry points');

 const view=await request('/databaze/');const viewHtml=await view.text();
 check(viewHtml.includes('Zpět na úvod')&&viewHtml.includes('href="/"'),'public database has a visible landing-page link');
 check(view.headers.get('cache-control')?.includes('no-store'),'public HTML cannot retain outdated script references');
 const assetUrls=[...new Set([...viewHtml.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+\.(?:js|css))"/g)].map(m=>m[1]))];
 check(assetUrls.length>0,'rendered page advertises client assets');
 for(const url of assetUrls){const asset=await request(url);assert.equal(asset.status,200,`Missing rendered asset ${url}`);}
 check(true,'all scripts and styles referenced by the page are available');
 const clientScripts=(await readdir('dist/client/_next/static/chunks')).filter(v=>v.endsWith('.js'));
 for(const file of clientScripts){const asset=await request('/_next/static/chunks/'+file);assert.equal(asset.status,200,`Missing client module ${file}`);}
 check(true,'all lazy-loaded client modules are available');
 let publicHtml=await (await request('/databaze/?q=transport')).text();
 const searchRows=publicHtml.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1]??'';
 check(searchRows.includes('Modelový transport s.r.o.')&&!searchRows.includes('Vzorová výroba s.r.o.'),'search form works as a server GET without JavaScript');
 publicHtml=await (await request('/databaze/?strana=2')).text();const pageRows=publicHtml.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1]??'';
 check(pageRows.includes('Vzorová jazyková škola s.r.o.')&&!pageRows.includes('Vzorová výroba s.r.o.'),'pagination links work as server GETs without JavaScript');
 check(viewHtml.includes('href="/panel/"')&&viewHtml.includes('href="/registrace/"')&&viewHtml.includes('href="/prihlaseni/"'),'contact and account controls have real navigation targets');
 for(const path of ['/registrace/','/prihlaseni/']){const body=await (await request(path)).text();check(body.includes('Zpět na úvod')&&body.includes('href="/"'),`${path} has a landing-page link`);}
 const panelBody=await (await request('/panel/','alice')).text();check(panelBody.includes('p-return-home')&&panelBody.includes('Zpět na úvod'),'all dashboard views share a visible landing-page link');

 // Exercise the shared client filter with the actual authorized dataset, then
 // compare native public GET results. Public and panel filters must use AND.
 const ts=require('typescript');
 const filterModule=ts.transpileModule(await readFile('lib/company-types.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 const {filterCompanies,COMPANY_CATEGORIES,CZECH_REGIONS}=await import('data:text/javascript;base64,'+Buffer.from(filterModule).toString('base64'));
 check(COMPANY_CATEGORIES.length===12&&CZECH_REGIONS.length===14,'all 12 requested categories and 14 Czech regions are available');
 check(new Set(protectedData.companies.map(c=>c.category)).size===12&&new Set(protectedData.companies.map(c=>c.region)).size===14,'demo records cover every category and region');
 for(const body of [viewHtml,panelBody]){
  const categories=body.match(/<select[^>]*name="kategorie"[^>]*>([\s\S]*?)<\/select>/)?.[1]??'';
  const regions=body.match(/<select[^>]*name="kraj"[^>]*>([\s\S]*?)<\/select>/)?.[1]??'';
  check(COMPANY_CATEGORIES.every(c=>categories.includes(`value="${c.id}"`))&&CZECH_REGIONS.every(c=>regions.includes(`value="${c.id}"`))&&regions.includes('Celá republika'),'database filter menus contain the complete category and region choices');
 }
 const combinations=[
  ['stavebnictvi','ustecky','',['demo-13','demo-14']],
  ['auto-moto','karlovarsky','',['demo-15','demo-16']],
  ['reality','','',['demo-17','demo-18','demo-19']],
  ['','pardubicky','',['demo-24','demo-31']],
  ['stavebnictvi','ustecky','USTI',['demo-13']],
  ['zdravotnictvi','praha','',[]],
 ];
 for(const [category,region,query,expected] of combinations){
  const panelMatches=filterCompanies(protectedData.companies,query,category,region);
  assert.deepEqual(panelMatches.map(c=>c.id),expected);
  const params=new URLSearchParams({kategorie:category,kraj:region,q:query});
  const response=await request('/databaze/?'+params);const body=await response.text();
  const rows=body.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1]??'';
  const rendered=protectedData.companies.filter(c=>rows.includes(c.name)).map(c=>c.id);
  check(response.status===200&&JSON.stringify(rendered)===JSON.stringify(expected),`category + region + search combine correctly: ${category||'all'} / ${region||'country'} / ${query||'all names'}`);
  check(!hasContact(body),'filtered public response keeps all contact details locked');
  if(!expected.length)check(body.includes('Žádná firma neodpovídá filtrům.')&&body.includes('Vymazat filtry'),'empty combinations offer a clear reset');
 }
 const filteredPage=await (await request('/databaze/?kategorie=sluzby-obchod-prodej&strana=2')).text();
 const filteredRows=filteredPage.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1]??'';
 check(filteredRows.includes('Demo obchod Kladno s.r.o.')&&filteredRows.includes('Ukázkový obchod Pardubice s.r.o.')&&filteredPage.includes('Strana'),'pagination stays within the selected category');
 check(filteredPage.includes('kategorie=sluzby-obchod-prodej'),'pagination links retain active filters');
 const resetResults=filterCompanies(protectedData.companies,'','','');
 check(resetResults.length===protectedData.companies.length,'clearing search, category and region restores the full dataset');
 const icoResult=filterCompanies(protectedData.companies,'00000015','auto-moto','karlovarsky');
 check(icoResult.length===1&&icoResult[0].id==='demo-15','panel IČO search combines with category and region');
 const invalidPage=await (await request('/databaze/?kategorie=unknown&kraj=unknown&strana=999999')).text();
 check(invalidPage.replace(/<!--[\s\S]*?-->/g,'').includes('Strana 2 z 2'),'invalid URL filters and oversized pages fall back safely');

 // Import and real-catalog behavior in an isolated database only.
 const importHeaders={'content-type':'application/json',authorization:'Bearer local-import-test-token'};
 const seed=Array.from({length:45},(_,i)=>({id:'zf:'+(8000000+i),name:'Testovací katalog '+String(i).padStart(3,'0'),ico:String(90000000+i),phones:['+420 999 000 111','+420 999 000 222'],emails:['private-'+i+'@example.test','second-'+i+'@example.test'],websites:['https://example.test/'+i],categories:i===0?['stavebnictvi','reality']:['stavebnictvi'],sourceUrl:'https://example.test/source',fetchedAt:'2026-10-01'}));
 const payload={action:'batch',chunk:0,hash:'a'.repeat(64),rows:seed};
 const importRequest=body=>mf.dispatchFetch(origin+'/api/catalog-import/',{method:'POST',headers:importHeaders,body:JSON.stringify(body)});
 let imported=await mf.dispatchFetch(origin+'/api/catalog-import/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});check(imported.status===404,'anonymous visitors cannot import data');
 imported=await importRequest(payload);check(imported.status===200,'authorized data import accepts a bounded batch');
 imported=await importRequest(payload);check(imported.status===200&&(await imported.json()).alreadyImported,'import retries are idempotent');
 imported=await importRequest({...payload,hash:'b'.repeat(64)});check(imported.status===409,'mismatched retry checksums are rejected');
 imported=await importRequest({action:'finish'});check(imported.status===409,'incomplete data cannot be activated');
 await db.prepare("UPDATE catalog_meta SET ready=1,total=45,with_email=45 WHERE id='kontakty-2026-10-01'").run();
 const publicCatalog=await (await request('/api/public-companies/?kategorie=stavebnictvi&strana=2')).json();
 check(publicCatalog.total===45&&publicCatalog.items.length===20&&publicCatalog.page===2,'real catalog is filtered and paginated on the server');
 check(publicCatalog.items.every(c=>Object.keys(c).sort().join(',')==='category,id,name,region'),'public API exposes only explicit safe fields');
 check(!JSON.stringify(publicCatalog).includes('private-')&&!JSON.stringify(publicCatalog).includes('+420')&&!JSON.stringify(publicCatalog).includes('900000'),'public API hides contacts and IČO');
 const full=await (await request('/api/companies/?ids=zf:8000000','alice')).json();check(full.items[0].emails.length===2&&full.items[0].phones.length===2&&full.items[0].categories.length===2,'authorized profiles preserve multiple contacts and categories');
 for(const cat of ['stavebnictvi','reality']){const found=await (await request('/api/public-companies/?q=Testovaci%20000&kategorie='+cat)).json();check(found.items[0]?.id==='zf:8000000','accent-insensitive search finds a company in each of its categories');}
 r=await request('/api/companies/');check(r.status===401,'anonymous contact API access is rejected');
 r=await request('/api/companies/','charlie');check(r.status===403,'unfinished registrations cannot access real contacts');
 const byIco=await (await request('/api/companies/?q=90000000','alice')).json();check(byIco.items.length===1&&byIco.items[0].id==='zf:8000000','indexed IČO search finds the real company');
 const secureList=await action('alice',{action:'save-list',data:{name:'Skutečné firmy',companyIds:['zf:8000000','zf:8000001']}});
 const realList=secureList.lists.find(l=>l.name==='Skutečné firmy');r=await request('/api/companies/?list='+realList.id,'bob');check(r.status===404,'other users cannot read saved-list contacts');
 const listPage=await (await request('/api/companies/?list='+realList.id,'alice')).json();check(listPage.total===2,'saved lists work with imported IDs');
 const realHtml=await (await request('/databaze/')).text();check(realHtml.includes('Testovací katalog')&&!realHtml.includes('private-')&&!realHtml.includes('+420 999'),'real public HTML contains no contacts');
 check(realHtml.includes('Zdrojová databáze neobsahuje kraje.')&&realHtml.includes('disabled="" name="kraj"'),'missing source regions are disclosed instead of invented');
 imported=await importRequest({...payload,chunk:1});check(imported.status===409,'completed imports reject further writes');
 console.log(`\n${checked} integration checks passed.`);
}finally{await mf.dispose();}
