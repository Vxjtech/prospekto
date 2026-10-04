'use client';
import {UserRound,BriefcaseBusiness,Building2,Check,ArrowRight} from 'lucide-react';
import type {AccountType} from '@/lib/accounts/model';
const choices=[
  {type:'CUSTOMER',title:'Běžný uživatel',description:'Hledám řemeslníka nebo firmu.',Icon:UserRound,features:['Zadávání poptávek','Hledání dodavatelů','Komunikace s dodavateli','Správa vlastních poptávek','Hodnocení firem a řemeslníků'],cta:'Pokračovat jako zákazník'},
  {type:'SELF_EMPLOYED',title:'Živnostník',description:'Pracuji sám na sebe a hledám nové zakázky.',Icon:BriefcaseBusiness,features:['Získávání nových poptávek','Profil živnostníka a reference','Nabídky zdarma a přehled zakázek','Nabídky zákazníkům','Statistiky'],cta:'Pokračovat jako živnostník'},
  {type:'COMPANY',title:'Firma',description:'Jsme firma a chceme získávat a spravovat zakázky.',Icon:Building2,features:['Firemní profil a poptávky','Nabídky zdarma a přehled zakázek','Více členů týmu','Nabídky a statistiky','Budoucí pokročilé firemní funkce'],cta:'Pokračovat jako firma'},
] as const;
export function TypePicker({onChoose,busy=false,legacy=false}:{onChoose:(type:AccountType)=>void;busy?:boolean;legacy?:boolean}) {
  return <section className="m-type-picker"><div className="m-intro"><span className="m-eyebrow">Vítejte v Prospektu</span><h1>{legacy?'Dokončete nastavení Prospekto':'Jak chcete Prospekto používat?'}</h1><p>Vyberte typ účtu. Nastavení můžete později upravit.</p></div><div className="m-type-grid">{choices.map(({type,title,description,Icon,features,cta})=><article className="m-type-card" key={type}><span className="m-type-icon"><Icon size={26}/></span><h2>{title}</h2><p>{description}</p><ul>{features.map(f=><li key={f}><Check size={16}/>{f}</li>)}</ul><button className="p-button" disabled={busy} onClick={()=>onChoose(type)}>{cta}<ArrowRight size={17}/></button></article>)}</div></section>;
}
