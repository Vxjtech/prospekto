import 'server-only';
import {categoryLabel,type CategoryId,type RegionId,type Company,type PublicCompany} from './company-types';

// Fictional demo records. Keep existing IDs stable for saved lists and campaigns.
const records:[string,string,CategoryId,RegionId][]=[
 ['Vzorová výroba s.r.o.','Praha','sluzby-obchod-prodej','praha'],
 ['Ukázkový servis s.r.o.','Brno','sluzby-obchod-prodej','jihomoravsky'],
 ['Modelová stavba s.r.o.','Ostrava','stavebnictvi','moravskoslezsky'],
 ['Demo logistika s.r.o.','Plzeň','sluzby-obchod-prodej','plzensky'],
 ['Ukázková dílna s.r.o.','Brno','sluzby-obchod-prodej','jihomoravsky'],
 ['Vzorové poradenství s.r.o.','Praha','finance-ekonomika-pravo','praha'],
 ['Modelová doprava s.r.o.','Olomouc','sluzby-obchod-prodej','olomoucky'],
 ['Demo projekty s.r.o.','Ostrava','stavebnictvi','moravskoslezsky'],
 ['Vzorový nábytek s.r.o.','Plzeň','sluzby-obchod-prodej','plzensky'],
 ['Ukázkové studio s.r.o.','Olomouc','sluzby-obchod-prodej','olomoucky'],
 ['Demo konstrukce s.r.o.','Praha','stavebnictvi','praha'],
 ['Modelový transport s.r.o.','Brno','sluzby-obchod-prodej','jihomoravsky'],
 ['Ukázkové stavby Ústí s.r.o.','Ústí nad Labem','stavebnictvi','ustecky'],
 ['Modelové rekonstrukce s.r.o.','Děčín','stavebnictvi','ustecky'],
 ['Vzorové auto Karlovy Vary s.r.o.','Karlovy Vary','auto-moto','karlovarsky'],
 ['Demo motoservis Sokolov s.r.o.','Sokolov','auto-moto','karlovarsky'],
 ['Ukázkové reality Praha s.r.o.','Praha','reality','praha'],
 ['Modelové reality Ústí s.r.o.','Ústí nad Labem','reality','ustecky'],
 ['Vzorové reality Brno s.r.o.','Brno','reality','jihomoravsky'],
 ['Demo obchod Kladno s.r.o.','Kladno','sluzby-obchod-prodej','stredocesky'],
 ['Ukázková správa budov s.r.o.','České Budějovice','urady-sprava','jihocesky'],
 ['Vzorová jazyková škola s.r.o.','Liberec','vzdelani-jazyky','liberecky'],
 ['Modelové zahradnictví s.r.o.','Hradec Králové','zahrada-zemedelstvi-zvirata','kralovehradecky'],
 ['Ukázkové účetnictví s.r.o.','Pardubice','finance-ekonomika-pravo','pardubicky'],
 ['Demo penzion Vysočina s.r.o.','Jihlava','restaurace-ubytovani','vysocina'],
 ['Vzorové IT studio s.r.o.','Zlín','vypocetni-technika-internet','zlinsky'],
 ['Modelová kultura s.r.o.','České Budějovice','zabava-kultura','jihocesky'],
 ['Ukázková zdravotní technika s.r.o.','Liberec','zdravotnictvi','liberecky'],
 ['Demo restaurace Cheb s.r.o.','Cheb','restaurace-ubytovani','karlovarsky'],
 ['Vzorové auto Teplice s.r.o.','Teplice','auto-moto','ustecky'],
 ['Ukázkový obchod Pardubice s.r.o.','Pardubice','sluzby-obchod-prodej','pardubicky'],
 ['Modelová stavební dílna s.r.o.','Karlovy Vary','stavebnictvi','karlovarsky'],
];
export const companies:Company[]=records.map(([name,city,category,region],i)=>({id:`demo-${i+1}`,name,city,category,region,industry:categoryLabel(category),ico:String(i+1).padStart(8,'0'),phone:`+420 000 000 ${String(i+1).padStart(3,'0')}`,email:i<12?`info@firma-${String.fromCharCode(97+i)}.example`:`info@firma-demo-${i+1}.example`,website:i<12?`firma-${String.fromCharCode(97+i)}.example`:`firma-demo-${i+1}.example`}));

// Public filtering metadata only: contact details, IČO and city stay server-side.
export function getPublicCompanies():PublicCompany[]{return companies.map(({id,name,category,region})=>({id,name,category,region}));}
