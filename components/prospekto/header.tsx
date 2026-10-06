'use client';
import {useEffect,useRef,useState} from 'react';
import {HeaderAccountActions} from './header-account-actions';
import {Logo} from './logo';
import {Icon} from './icon';
const links=[['Pracovní nabídky','/prace/'],['Databáze','/databaze/'],['Jak to funguje','#jak-to-funguje'],['Cena','#cena'],['Otázky','#otazky']];
export function Header(){
 const[open,setOpen]=useState(false);const toggle=useRef<HTMLButtonElement>(null);
 useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'&&open){setOpen(false);toggle.current?.focus();}};document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey);},[open]);
 return <header className="header container landing-header"><Logo /><nav className="desktop-nav" aria-label="Hlavní navigace">{links.map(([text,href])=><a key={href} href={href}>{text}</a>)}</nav><HeaderAccountActions/><button ref={toggle} className="menu-toggle" onClick={()=>setOpen(!open)} aria-expanded={open} aria-controls="mobile-navigation" aria-label={open?'Zavřít menu':'Otevřít menu'}><Icon name={open?'close':'menu'} /></button>{open&&<nav id="mobile-navigation" className="mobile-nav" aria-label="Mobilní navigace">{links.map(([text,href])=><a key={href} href={href} onClick={()=>setOpen(false)}>{text}</a>)}<a className="mobile-access" href="/registrace/" onClick={()=>setOpen(false)}>Vytvořit účet</a></nav>}</header>;
}
