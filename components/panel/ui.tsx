'use client';
import {useId,cloneElement,isValidElement} from 'react';
import Image from 'next/image';
import type {ReactNode,ButtonHTMLAttributes} from 'react';
import {Button} from '@/components/ui/button';
import {Info} from 'lucide-react';
export function PanelButton({secondary=false,danger=false,className='',...props}:ButtonHTMLAttributes<HTMLButtonElement>&{secondary?:boolean;danger?:boolean}){return <Button className={`p-button ${secondary?'p-secondary':''} ${danger?'p-danger':''} ${className}`} {...props}/>;}
export function Field({label,hint,children}: {label:string;hint?:string;children:ReactNode}){const id=useId();
 const native=isValidElement<{'aria-labelledby'?:string;'aria-describedby'?:string}>(children)&&typeof children.type==='string'&&['input','select','textarea'].includes(children.type);
 const control=native?cloneElement(children,{'aria-labelledby':id,'aria-describedby':hint?id+'-hint':undefined}):children;
 return <label className="p-field"><span id={id}>{label}</span>{control}{hint&&<small id={id+'-hint'}>{hint}</small>}</label>;}
export function Notice({children}: {children:ReactNode}){return <div className="p-notice"><Info size={18} aria-hidden="true"/><div>{children}</div></div>;}
export function Empty({title,children,action}: {title:string;children:ReactNode;action?:ReactNode}){return <div className="p-empty"><div className="p-empty-symbol"><Image src="/brand/prospekto-mark.svg?v=20260930-p" alt="" width={36} height={36}/></div><h2>{title}</h2><p>{children}</p>{action}</div>;}
