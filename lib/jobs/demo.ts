import type {Job} from './model';

// Illustrative listings only. They do not belong to an employer account and cannot accept applications.
export const isDemoJob=(id:string)=>id.startsWith('demo-');
export function demoJobs():Job[] {
 const now=new Date(),expires=new Date(now);
 expires.setUTCFullYear(expires.getUTCFullYear()+1);
 const publishedAt=now.toISOString(),expiresAt=expires.toISOString().slice(0,10);
 const common={
  accountId:'',companyIco:'',companyLogo:'',address:'',salaryPeriod:'MONTH' as const,
  education:'ANY' as const,experience:'ANY' as const,languages:'',
  suitableGraduates:false,suitableDisability:false,contactName:'Prospekto – ukázka',
  contactEmail:'',contactPhone:'',applyUrl:'',startDate:'',
  expiresAt,status:'PUBLISHED' as const,publishedAt,createdAt:publishedAt,updatedAt:publishedAt,
 };
 return ([
  {id:'demo-stavbyvedouci',title:'Stavbyvedoucí',companyName:'Ukázková stavební firma (DEMO)',category:'construction',city:'Praha',region:'praha',employmentTypes:['FULL_TIME'],workMode:'ONSITE',salaryMin:55000,salaryMax:75000,description:'Ukázková pracovní pozice pro představení katalogu Prospekto. Firma a uvedené podmínky jsou smyšlené.',responsibilities:'Koordinace stavebních prací, harmonogramu a dodavatelů na projektu.',requirements:'Zkušenost se stavbou a schopnost vést menší tým.',benefits:'Pružná pracovní doba a podpora profesního rozvoje.',experience:'EXPERIENCED'},
  {id:'demo-frontend-vyvojar',title:'Frontend vývojář / vývojářka',companyName:'Ukázkové digitální studio (DEMO)',category:'it',city:'Brno',region:'jihomoravsky',employmentTypes:['FULL_TIME','CONTRACTOR'],workMode:'HYBRID',salaryMin:60000,salaryMax:90000,description:'Ukázkový inzerát představující nabídky v IT. Zaměstnavatel i výše odměny jsou pouze ilustrativní.',responsibilities:'Vývoj uživatelského rozhraní webových aplikací a spolupráce s designéry.',requirements:'Znalost Reactu, TypeScriptu a základů přístupnosti.',benefits:'Možnost práce z domova a vzdělávací rozpočet.',experience:'EXPERIENCED'},
  {id:'demo-skladnik',title:'Skladník / skladnice',companyName:'Ukázkové logistické centrum (DEMO)',category:'logistics',city:'Ústí nad Labem',region:'ustecky',employmentTypes:['FULL_TIME'],workMode:'ONSITE',salaryMin:32000,salaryMax:39000,description:'Fiktivní nabídka ukazuje, jak může vypadat pozice v logistice v Prospektu.',responsibilities:'Příjem a výdej zboží, příprava zásilek a práce se skladovým systémem.',requirements:'Spolehlivost, pečlivost a ochota pracovat v týmu.',benefits:'Zaškolení a příspěvek na stravování.',suitableGraduates:true},
  {id:'demo-obchodni-zastupce',title:'Obchodní zástupce / zástupkyně',companyName:'Ukázková obchodní společnost (DEMO)',category:'sales',city:'Plzeň',region:'plzensky',employmentTypes:['FULL_TIME'],workMode:'HYBRID',salaryMin:40000,salaryMax:65000,description:'Ilustrativní nabídka v obchodu. Nejde o skutečné výběrové řízení.',responsibilities:'Péče o klienty, příprava nabídek a vyhledávání nových příležitostí.',requirements:'Dobré komunikační dovednosti a samostatnost.',benefits:'Flexibilní pracovní doba a průběžné školení.'},
  {id:'demo-administrativni-pracovnik',title:'Administrativní pracovník / pracovnice',companyName:'Ukázková kancelář (DEMO)',category:'administration',city:'Litoměřice',region:'ustecky',employmentTypes:['PART_TIME','DPP'],workMode:'ONSITE',salaryMin:22000,salaryMax:28000,description:'Ukázka částečného úvazku pro náhled pracovního portálu. Všechny údaje jsou fiktivní.',responsibilities:'Zpracování dokumentů, evidence objednávek a běžná komunikace.',requirements:'Základní práce s počítačem a pečlivost.',benefits:'Zaškolení a možnost plánování směn.',suitableGraduates:true},
 ] satisfies Array<Partial<Job>&Pick<Job,'id'|'title'|'companyName'|'category'|'city'|'region'|'employmentTypes'|'workMode'|'description'|'responsibilities'|'requirements'|'benefits'>>)
 .map(job=>({...common,...job}) as Job);
}
