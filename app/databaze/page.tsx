/* eslint-disable @next/next/no-html-link-for-pages -- Public navigation has a native fallback. */
import {HomeLink} from '@/components/prospekto/home-link';
import {Logo} from '@/components/prospekto/logo';
import {CompanyBrowser} from '@/components/prospekto/company-browser';
import {HeaderAccountActions} from '@/components/prospekto/header-account-actions';
import {getPublicCompanies} from '@/lib/companies';
import {COMPANY_CATEGORIES,CZECH_REGIONS} from '@/lib/company-types';

export const metadata={title:'Databáze firem — veřejné demo | Prospekto',description:'Prohlédněte si názvy firem v ukázce databáze Prospekto bez registrace. Kontaktní údaje odemknete po přihlášení.'};

export const dynamic='force-dynamic';

export default async function PublicDatabase({searchParams}:{searchParams:Promise<{q?:string|string[];strana?:string|string[];kategorie?:string|string[];kraj?:string|string[]}>}){
 const params=await searchParams;
 const query=typeof params.q==='string'?params.q.slice(0,200):'';
 const page=typeof params.strana==='string'&&/^\d{1,6}$/.test(params.strana)?Math.max(1,Number(params.strana)):1;
 const category=COMPANY_CATEGORIES.find(item=>item.id===params.kategorie)?.id??'';
 const region=CZECH_REGIONS.find(item=>item.id===params.kraj)?.id??'';
 const database=await getPublicCompanies({query,category,region,page,pageSize:20}).catch(()=>null);
 return <div className="public-database-page" id="nahoru">
  <a className="skip-link" href="#databaze-obsah">Přejít na databázi</a>
  <header className="header container public-database-header"><a href="/" aria-label="Prospekto — úvodní stránka"><Logo link={false}/></a><HeaderAccountActions/></header>
  <main className="container public-database-main" id="databaze-obsah"><HomeLink className="database-return-home"/><div className="public-database-heading"><h1>Najděte své další klienty.</h1><p>Prohlédněte si názvy firem bez registrace.<br/>Telefon, e-mail a web odemknete po přihlášení.</p></div>{database?<CompanyBrowser key={[query,category,region,page].join('|')} initialData={database} fullPage initialQuery={query} initialPage={page} initialCategory={category} initialRegion={region}/>:<p role="alert">Databázi se nepodařilo načíst. <a href="/databaze/">Zkusit znovu</a></p>}<p className="public-database-footnote">{database?.ready?'Veřejný náhled databáze. Kontaktní údaje jsou dostupné po přihlášení.':'Právě prohlížíte ilustrační demo. Import databáze se připravuje.'}</p></main>
 </div>;
}
