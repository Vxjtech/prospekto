'use client';
import {UserRound,BriefcaseBusiness,Check,ArrowRight} from 'lucide-react';
import type {AccountType} from '@/lib/accounts/model';
const choices=[
  {type:'CUSTOMER',title:'Běžný uživatel',description:'Hledám řemeslníka nebo firmu.',Icon:UserRound,features:['Zadávání poptávek','Hledání dodavatelů','Komunikace s dodavateli','Správa vlastních poptávek','Hodnocení firem a řemeslníků'],cta:'Pokračovat jako zákazník'},
  {type:'COMPANY',title:'Účet na IČO',description:'Podnikám a chci získávat nové zakázky. Pro jednotlivce i týmy.',Icon:BriefcaseBusiness,features:['Jeden účet pro každého s IČO','Profil, služby a reference','Odesílání nabídek zdarma','Společná správa zakázek a týmu','100 000 kreditů pro vyzkoušení'],cta:'Registrovat se na IČO'},
] as const;
export function TypePicker({onChoose,busy=false,legacy=false}:{onChoose:(type:AccountType)=>void;busy?:boolean;legacy?:boolean}) {
  return <section className="m-type-picker"><div className="m-intro"><span className="m-eyebrow">Vítejte v Prospektu</span><h1>{legacy?'Dokončete nastavení Prospekto':'Jak chcete Prospekto používat?'}</h1><p>Hledáte dodavatele, nebo nabízíte služby na IČO?</p></div><div className="m-type-grid">{choices.map(({type,title,description,Icon,features,cta})=><article className="m-type-card" key={type}><span className="m-type-icon"><Icon size={26}/></span><h2>{title}</h2><p>{description}</p><ul>{features.map(f=><li key={f}><Check size={16}/>{f}</li>)}</ul><button className="p-button" disabled={busy} onClick={()=>onChoose(type)}>{cta}<ArrowRight size={17}/></button></article>)}</div></section>;
}
