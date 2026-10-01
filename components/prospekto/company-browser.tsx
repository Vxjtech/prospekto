'use client';
/* eslint-disable @next/next/no-html-link-for-pages -- Native URLs keep public controls usable before hydration. */

import {useState,type MouseEvent} from 'react';
import {LockKeyhole} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {categoryLabel,regionLabel,companyQuery,paginationPages,type CompanyPage,type PublicCompany} from '@/lib/company-types';
import {CompanyFilterFields} from './company-filter-fields';
import {useCompanyPage} from './use-company-page';
import {Logo} from './logo';
import {Icon} from './icon';

function LockedContact({onClick,label='Zobrazit kontakty po přihlášení'}:{onClick?:(event:MouseEvent<HTMLAnchorElement>)=>void;label?:string}){
 return <a href="/panel/" className="locked-contact" onClick={onClick} aria-label={label}><LockKeyhole size={15} aria-hidden="true"/><span>Po přihlášení</span></a>;
}

export function CompanyBrowser({initialData,fullPage=false,initialQuery='',initialPage=1,initialCategory='',initialRegion=''}:{initialData:CompanyPage;fullPage?:boolean;initialQuery?:string;initialPage?:number;initialCategory?:string;initialRegion?:string}){
 const [query,setQuery]=useState(initialQuery);
 const [category,setCategory]=useState(initialCategory);
 const [region,setRegion]=useState(initialRegion);
 const [page,setPage]=useState(initialPage);
 const [selected,setSelected]=useState<PublicCompany|null>(null);
 const filters={query,category,region,page,pageSize:fullPage?20:4};
 const params=companyQuery(filters);if(!fullPage)params.set('compact','1');
 const {data,loading,error,retry}=useCompanyPage('/api/public-companies/',params,initialData);
 const pageCount=data.pageCount,currentPage=data.page;
 const visible=loading||error?[]:data.items;
 const reset=(event:MouseEvent<HTMLAnchorElement>)=>{event.preventDefault();setQuery('');setCategory('');setRegion('');setPage(1);};
 function pageUrl(number:number){const params=new URLSearchParams();if(query)params.set('q',query);if(category)params.set('kategorie',category);if(region)params.set('kraj',region);if(number>1)params.set('strana',String(number));return '/databaze/'+(params.size?'?'+params.toString():'');}
 function openCompany(event:MouseEvent<HTMLAnchorElement>,company:PublicCompany){event.preventDefault();setSelected(company);}

 return <>
  <div className={`company-browser public-company-browser${fullPage?' public-company-browser-full':''}`}>
   <div className="browser-toolbar">
    <div className="browser-identity"><Logo link={false}/><span className="browser-title">/ <span>Databáze firem</span></span></div>
    <span className="database-count">{data.ready?`${data.catalogTotal.toLocaleString('cs-CZ')} firem`:'Demo bez přihlášení'}</span>
   </div>
   <form action="/databaze/" method="get" className="browser-filters public-search-form" role="search">
    <label className="search-field"><Icon name="search" size={20}/><span className="sr-only">Hledat podle názvu firmy</span><input type="search" name="q" maxLength={200} value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}} placeholder="Hledat podle názvu firmy"/></label>
    <CompanyFilterFields regionsAvailable={data.regionsAvailable} category={category} region={region} onCategoryChange={value=>{setCategory(value);setPage(1);}} onRegionChange={value=>{setRegion(value);setPage(1);}}/>
    <Button className="action action-primary public-search-submit" type="submit">Hledat</Button>
    <a href="/panel/" className="public-search-note"><LockKeyhole size={16} aria-hidden="true"/> Kontakty po přihlášení</a>
   </form>
   {(query||category||region)&&<div className="filter-status public-active-filters"><span role="status">{data.total===1?'Nalezena 1 firma':`Nalezeno ${data.total} firem`}<small>{categoryLabel(category)||'Všechny kategorie'} · {regionLabel(region)||'Celá republika'}</small></span><a href="/databaze/" onClick={reset}>Vymazat filtry</a></div>}
   {loading?<div className="empty-state" role="status">Načítám firmy…</div>:error?<div className="empty-state" role="alert"><p>{error}</p><Button onClick={retry} className="action action-light">Zkusit znovu</Button></div>:visible.length>0?<>
    <div className="desktop-company-table"><table><caption className="sr-only">Veřejné demo: názvy firem, kontaktní údaje dostupné až po přihlášení</caption><thead><tr>{['Firma','Telefon','E-mail','Web'].map(heading=><th scope="col" key={heading}>{heading}</th>)}</tr></thead><tbody>{visible.map(company=><tr key={company.id}><td><a href="/panel/" className="company-name" onClick={event=>openCompany(event,company)}>{company.name}</a></td>{['telefon','e-mail','web'].map(field=><td key={field}><LockedContact label={`Zobrazit ${field} firmy ${company.name}`} onClick={event=>openCompany(event,company)}/></td>)}</tr>)}</tbody></table></div>
    <div className="mobile-company-cards">{visible.map(company=><article className="company-card" key={company.id}><a href="/panel/" className="company-name" onClick={event=>openCompany(event,company)}>{company.name}</a><a href="/panel/" className="public-card-lock" onClick={event=>openCompany(event,company)}><LockKeyhole size={17} aria-hidden="true"/><p>Telefon, e-mail a web<br/><span>Odemkněte po přihlášení.</span></p></a></article>)}</div>
   </>:<div className="empty-state" role="status"><Icon name="search" size={32}/><h3>Žádná firma neodpovídá filtrům.</h3><p>Zkuste jinou kategorii, kraj nebo kratší název firmy.</p><Button asChild className="action action-light"><a href="/databaze/" onClick={reset}>Vymazat filtry</a></Button></div>}
   <div className="browser-footer"><p>{data.ready?`${data.total.toLocaleString('cs-CZ')} firem odpovídá výběru`:`Ilustrační data · ${data.catalogTotal} ukázkových firem`}</p><nav className="pagination" aria-label="Stránkování firem">{paginationPages(currentPage,pageCount).map((number,index)=>number==='gap'?<span key={`gap-${index}`} aria-hidden="true">…</span>:<a key={number} href={pageUrl(number)} className={currentPage===number?'is-current':''} onClick={event=>{event.preventDefault();setPage(number);}} aria-label={`Strana ${number}`} aria-current={currentPage===number?'page':undefined}>{number}</a>)}</nav><span className="sr-only" role="status">Strana {currentPage} z {pageCount}, zobrazeno {visible.length} firem.</span></div>
   {fullPage&&<div className="public-unlock"><div className="public-unlock-copy"><span className="public-lock-icon"><LockKeyhole size={23} aria-hidden="true"/></span><div><h2>Najděte firmu. Odemkněte kontakty.</h2><p>Vytvořte si účet a otevřete telefon, e-mail i web ve svém panelu.</p></div></div><div className="public-unlock-actions"><Button asChild className="action action-primary"><a href="/registrace/">Vytvořit účet</a></Button><a href="/prihlaseni/" className="public-login-link">Už mám účet</a></div></div>}
  </div>
  <Dialog open={!!selected} onOpenChange={open=>{if(!open)setSelected(null);}}><DialogContent className="prospekto-dialog"><DialogTitle>{selected?.name??'Firemní profil'}</DialogTitle><DialogDescription>Název firmy si můžete prohlédnout bez účtu. Telefon, e-mail a web jsou dostupné po registraci a přihlášení.</DialogDescription><div className="public-detail-locks">{['Telefon','E-mail','Web'].map(label=><div key={label}><span>{label}</span><LockedContact/></div>)}</div><Button asChild className="action action-primary"><a href="/panel/">Zobrazit kontakty</a></Button>{!data.ready&&<p className="public-demo-note">Ukázková firma · všechny kontakty jsou fiktivní.</p>}</DialogContent></Dialog>
 </>;
}
