'use client';
import {useState,type FormEvent} from 'react';
import {CalendarDays,ChevronLeft,ChevronRight} from 'lucide-react';
import {PanelButton} from '@/components/panel/ui';
import type {Task} from '@/lib/marketplace/model';

const weekdays=['Po','Út','St','Čt','Pá','So','Ne'];
const pad=(value:number)=>String(value).padStart(2,'0');
const dayKey=(date:Date)=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
const dateLabel=(value:string,options:Intl.DateTimeFormatOptions)=>new Date(value).toLocaleString('cs-CZ',options);

export function CalendarView({tasks,busy,onCreate,onToggle}:{tasks:Task[];busy:boolean;onCreate:(title:string,dueAt:string)=>Promise<boolean>;onToggle:(id:string,done:boolean)=>Promise<boolean>}){
 const today=new Date(),[month,setMonth]=useState(()=>new Date(today.getFullYear(),today.getMonth(),1)),[selected,setSelected]=useState(()=>dayKey(today));
 const monthStart=new Date(month.getFullYear(),month.getMonth(),1),firstDay=(monthStart.getDay()+6)%7;
 const gridStart=new Date(month.getFullYear(),month.getMonth(),1-firstDay),days:Date[]=[];
 const count=Math.ceil((firstDay+new Date(month.getFullYear(),month.getMonth()+1,0).getDate())/7)*7;
 for(let i=0;i<count;i++)days.push(new Date(gridStart.getFullYear(),gridStart.getMonth(),gridStart.getDate()+i));
 const events=tasks.filter(task=>task.dueAt).sort((a,b)=>a.dueAt!.localeCompare(b.dueAt!));
 const selectedTasks=events.filter(task=>dayKey(new Date(task.dueAt!))===selected);
 const marked=new Set(events.map(task=>dayKey(new Date(task.dueAt!))));
 const defaultTime=`${selected}T10:00`;

 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();const formElement=event.currentTarget;
  const form=new FormData(formElement),title=String(form.get('title')??'').trim(),value=String(form.get('dueAt')??'');
  const dueAt=new Date(value);
  if(!title||!value||Number.isNaN(dueAt.getTime()))return;
  if(await onCreate(title,dueAt.toISOString()))formElement.reset();
 }
 function changeMonth(offset:number){
  const next=new Date(month.getFullYear(),month.getMonth()+offset,1),lastDay=new Date(next.getFullYear(),next.getMonth()+1,0).getDate();
  const nextSelected=dayKey(new Date(next.getFullYear(),next.getMonth(),Math.min(Number(selected.slice(-2)),lastDay)));
  setMonth(next);setSelected(nextSelected);
 }
 return <section className="m-calendar" aria-label="Kalendář úkolů">
  <div className="m-calendar-toolbar">
   <div><span className="m-eyebrow">Váš přehled</span><h2><CalendarDays size={22}/> Váš rozvrh</h2></div>
   <div className="m-calendar-actions"><a className="p-button p-secondary" href="/api/calendar/subscribe/"><CalendarDays size={17}/> Přidat do Apple Calendaru</a></div>
  </div>
  <div className="m-calendar-layout">
   <section className="p-card m-calendar-month" aria-label="Měsíční kalendář">
    <header><button type="button" aria-label="Předchozí měsíc" onClick={()=>changeMonth(-1)}><ChevronLeft size={20}/></button><h3>{month.toLocaleDateString('cs-CZ',{month:'long',year:'numeric'})}</h3><button type="button" aria-label="Další měsíc" onClick={()=>changeMonth(1)}><ChevronRight size={20}/></button></header>
    <div className="m-calendar-grid" style={{gridTemplateRows:`auto repeat(${days.length/7}, minmax(0, 1fr))`}} aria-label={month.toLocaleDateString('cs-CZ',{month:'long',year:'numeric'})}>
     {weekdays.map(day=><span className="m-calendar-weekday" key={day}>{day}</span>)}
     {days.map(day=>{
      const key=dayKey(day),inMonth=day.getMonth()===month.getMonth(),isToday=key===dayKey(today);
      return <button type="button" key={key} className={`m-calendar-day${inMonth?'':' outside'}${isToday?' today':''}${selected===key?' selected':''}`} aria-label={`${day.getDate()}. ${day.toLocaleDateString('cs-CZ',{month:'long',year:'numeric'})}${marked.has(key)?', naplánované úkoly':''}`} aria-pressed={selected===key} onClick={()=>setSelected(key)}><span>{day.getDate()}</span>{marked.has(key)&&<i aria-hidden="true"/>}</button>;
     })}
    </div>
    <p className="m-calendar-legend"><i aria-hidden="true"/> Naplánovaný úkol</p>
   </section>
   <section className="m-calendar-agenda" aria-live="polite">
    <form className="p-card m-calendar-form" onSubmit={event=>void submit(event)}><div className="m-calendar-form-heading"><h3>Naplánovat úkol</h3></div><label><span>Co je potřeba udělat?</span><input name="title" minLength={2} maxLength={300} placeholder="Např. Zavolat zákazníkovi" required/></label><label><span>Datum a čas</span><input key={selected} name="dueAt" type="datetime-local" defaultValue={defaultTime} required/></label><PanelButton disabled={busy} type="submit">Uložit do kalendáře</PanelButton></form>
    <div className="m-calendar-agenda-heading"><div><span className="m-eyebrow">Program dne</span><h3>{new Date(`${selected}T12:00:00`).toLocaleDateString('cs-CZ',{weekday:'long',day:'numeric',month:'long'})}</h3></div><span className="p-badge">{selectedTasks.length} {selectedTasks.length===1?'úkol':selectedTasks.length>1&&selectedTasks.length<5?'úkoly':'úkolů'}</span></div>
    {selectedTasks.length?<div className="m-calendar-events">{selectedTasks.map(task=><article className={`m-calendar-event${task.done?' done':''}`} key={task.id}><label><input type="checkbox" checked={!!task.done} disabled={busy} onChange={event=>void onToggle(task.id,event.target.checked)}/><span><strong>{task.title}</strong><small>{dateLabel(task.dueAt!,{hour:'2-digit',minute:'2-digit'})}</small></span></label></article>)}</div>:<p className="m-calendar-empty">Na tento den nemáte nic naplánováno.</p>}
   </section>
  </div>
  <p className="m-calendar-export-note">Apple Calendar se připojí k odběru a bude úkoly z Prospekta průběžně aktualizovat. Při prvním připojení potvrďte odběr v aplikaci Kalendář.</p>
 </section>;
}
