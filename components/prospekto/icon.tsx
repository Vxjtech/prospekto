export type IconName='search'|'filter'|'chevron'|'phone'|'mail'|'globe'|'check'|'plus'|'menu'|'target'|'list'|'close';
export function Icon({name,size=24}:{name:IconName;size?:number}){return <span className="design-icon" aria-hidden="true" style={{width:size,height:size,maskImage:`url(/icons/${name}.svg)`,WebkitMaskImage:`url(/icons/${name}.svg)`}} />;}
