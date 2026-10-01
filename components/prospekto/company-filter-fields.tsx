import {Building2,MapPin} from 'lucide-react';
import {COMPANY_CATEGORIES,CZECH_REGIONS,categoryLabel,regionLabel} from '@/lib/company-types';

export function CompanyFilterFields({category,region,onCategoryChange,onRegionChange,regionsAvailable=true}:{regionsAvailable?:boolean;category:string;region:string;onCategoryChange:(value:string)=>void;onRegionChange:(value:string)=>void}){
 return <>
  <label className="company-filter-field"><span><Building2 size={16} aria-hidden="true"/> Kategorie</span><select name="kategorie" aria-label="Kategorie" value={category} onChange={event=>onCategoryChange(event.target.value)} title={categoryLabel(category)||'Všechny kategorie'}><option value="">Všechny kategorie</option>{COMPANY_CATEGORIES.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
  <label className="company-filter-field"><span><MapPin size={16} aria-hidden="true"/> Kraj</span><select disabled={!regionsAvailable} name="kraj" aria-label="Kraj" value={region} onChange={event=>onRegionChange(event.target.value)} title={regionLabel(region)||'Celá republika'}><option value="">{regionsAvailable?'Celá republika':'Celá republika · kraj neuveden'}</option>{CZECH_REGIONS.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select>{!regionsAvailable&&<small className="company-region-note">Zdrojová databáze neobsahuje kraje.</small>}</label>
 </>;
}
