// Build in an isolated directory: the server application stays unchanged.
import {cpSync,mkdirSync,readFileSync,writeFileSync,rmSync,readdirSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
const root=process.cwd(), stage=resolve('.pages-preview');
rmSync(stage,{recursive:true,force:true});mkdirSync(stage);
for(const entry of ['app','components','lib','hooks','public','vendor','db','package.json','tsconfig.json','postcss.config.mjs']) cpSync(entry,join(stage,entry),{recursive:true});
for(const entry of readdirSync(join(stage,'app'))) if(!['page.tsx','layout.tsx','globals.css'].includes(entry)) rmSync(join(stage,'app',entry),{recursive:true,force:true});
let home=readFileSync(join(stage,'app/page.tsx'),'utf8').replace("import { getPublicCompanies } from '@/lib/companies';",`import { getPublicCompanies as demoCompanies } from '@/lib/demo-companies';
async function getPublicCompanies() { const items=demoCompanies().slice(0,4);return {items,withEmail:0,total:items.length,catalogTotal:items.length,page:1,pageSize:4,pageCount:1,ready:false,regionsAvailable:true}; }`)
.replace("export const dynamic='force-dynamic';",'')
.replace('firem v databázi','ilustrační firmy v ukázce');
writeFileSync(join(stage,'app/page.tsx'),home);
writeFileSync(join(stage,'next.config.ts'),`export default {output:'export',trailingSlash:true,images:{unoptimized:true}};`);
execFileSync(process.execPath,[resolve('node_modules/next/dist/bin/next'),'build','--webpack'],{cwd:stage,stdio:'inherit',env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'}});
const out=join(stage,'out');
let html=readFileSync(join(out,'index.html'),'utf8');
html=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*(?:as="script"|rel="modulepreload")[^>]*>/gi,'');
html=html.replace(/href="\/(?:#([^"]*))?"/g,(_,anchor)=>`href="#${anchor||'nahoru'}"`);
html=html.replace(/href="\/(?!_next\/|brand\/|favicon)([^"]*)"/g,'href="#preview-info" data-preview-link="true"');
html=html.replace(/(src|href)="\/(?!\/)/g,'$1="/prospekto/');
html=html.replace('<body>',`<body><aside id="preview-info" style="padding:12px 20px;text-align:center;background:#172a20;color:white;font:14px sans-serif">Ukázka hlavní stránky Prospekto · Firmy jsou ilustrační. Přihlášení, pracovní nabídky a poptávky nejsou v tomto náhledu dostupné.</aside>`);
html=html.replace('</body>',`<script>
document.addEventListener('click',function(e){const a=e.target.closest('[data-preview-link]');if(a){e.preventDefault();alert('Toto je ukázka hlavní stránky. Tato funkce bude dostupná v plné aplikaci Prospekto.');}const toggle=e.target.closest('.menu-toggle');if(toggle){let nav=document.getElementById('preview-mobile-nav');if(!nav){nav=document.querySelector('.desktop-nav').cloneNode(true);nav.id='preview-mobile-nav';nav.className='mobile-nav';toggle.closest('header').append(nav);}else nav.hidden=!nav.hidden;toggle.setAttribute('aria-expanded',String(!nav.hidden));}if(e.target.closest('#preview-mobile-nav a')){document.getElementById('preview-mobile-nav').hidden=true;document.querySelector('.menu-toggle').setAttribute('aria-expanded','false');}});
document.querySelectorAll('.company-browser input,.company-browser select,.company-browser button').forEach(e=>{e.disabled=true;e.title='Filtry jsou dostupné v plné aplikaci.';});
document.addEventListener('submit',e=>e.preventDefault());
</script></body>`);
writeFileSync(join(out,'index.html'),html);
function patchCss(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())patchCss(path);else if(path.endsWith('.css'))writeFileSync(path,readFileSync(path,'utf8').replace(/url\((["']?)\/(?!\/)/g,'url($1/prospekto/'));}}
patchCss(out);
writeFileSync(join(out,'.nojekyll'),'');
rmSync('pages-dist',{recursive:true,force:true});cpSync(out,'pages-dist',{recursive:true});
if(!existsSync('pages-dist/index.html'))throw new Error('Missing homepage');
console.log('Static homepage preview ready in pages-dist');
