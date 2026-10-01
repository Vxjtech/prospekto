import { getPublicCompanies } from '@/lib/companies';
import { Header } from '@/components/prospekto/header';
import { Logo } from '@/components/prospekto/logo';
import { Icon } from '@/components/prospekto/icon';
import { CompanyBrowser } from '@/components/prospekto/company-browser';
import { AccessButton } from '@/components/prospekto/access-button';
import { Button } from '@/components/ui/button';

const benefits = [
  { icon: 'phone' as const, title: 'Zavolejte rovnou správné firmě.', text: 'Telefonní kontakty přehledně u firemního profilu.' },
  { icon: 'mail' as const, title: 'Připravte relevantní B2B nabídku.', text: 'Firemní e-maily bez dalšího dohledávání.' },
  { icon: 'globe' as const, title: 'Poznejte firmu před oslovením.', text: 'Webové stránky a základní informace pohromadě.' },
];
const steps = [
  { icon: 'search' as const, title: 'Najděte svůj trh.', text: 'Vyberte obor a lokalitu. Zaměřte se na firmy, pro které má vaše nabídka smysl.' },
  { icon: 'list' as const, title: 'Prohlédněte si kontakty.', text: 'Telefon, e-mail i web u firemního profilu. Mějte před oslovením jasno.' },
  { icon: 'target' as const, title: 'Rozjeďte nový obchod.', text: 'Připravte osobní B2B nabídku a udělejte první krok k nové spolupráci.' },
];
const questions = [
  ['Co v databázi najdu?', '32 fiktivních firem pro vyzkoušení hledání, filtrů a práce s kontakty.'],
  ['Pro koho je Prospekto určené?', 'Pro obchodníky, agentury, dodavatele a všechny, kdo hledají nové B2B zákazníky v Česku.'],
  ['Má každá firma všechny kontakty?', 'Rozsah údajů se u jednotlivých firem může lišit. V profilu uvidíte, které kontakty jsou k dispozici.'],
];

export const dynamic='force-dynamic';

export default async function Home() {
  const database=await getPublicCompanies().catch(()=>null);
  return <>
    <a className="skip-link" href="#obsah">Přejít na obsah</a>
    <div className="hero-shell" id="nahoru"><div className="contours contours-light" aria-hidden="true" /><Header />
      <section className="hero container" aria-labelledby="hero-title"><h1 id="hero-title">VAŠI DALŠÍ KLIENTI.<br />UŽ JSOU TADY.</h1><p className="hero-description">Ukázková databáze českých firem.<br className="desktop-break" /> Vše pro vaše B2B nabídky na jednom místě.</p><div className="hero-actions"><Button asChild className="action action-primary"><a href="/databaze/">Zobrazit databázi</a></Button><Button asChild className="action action-light"><a href="#cena">Zobrazit cenu</a></Button></div><p className="hero-footnote">Ukázková verze · všechny firmy a kontakty jsou fiktivní.</p></section>
    </div>
    <main id="obsah">
      <section className="proof-strip container" aria-label="Prospekto v kostce"><div><strong>32</strong><span>Ukázkových firem</span></div><div className="proof-contacts"><strong>Telefon. E-mail. Web.</strong><span>Kontakty pohromadě</span></div><div><strong>Celá ČR</strong><span>Jedno přehledné místo</span></div></section>
      <section id="databaze" className="database-section section container" aria-labelledby="database-title"><div className="section-intro"><h2 id="database-title">Méně hledání.<br />Více obchodů.</h2><p>Najděte firmy, které potřebují vaše služby.<br className="desktop-break" /> Prohlédněte si názvy firem bez registrace.<br className="desktop-break" /> Kontakty odemknete po přihlášení.</p></div>{database?<CompanyBrowser initialData={database}/>:<p role="alert">Databázi se nepodařilo načíst. Zkuste stránku obnovit.</p>}<div className="database-bottom"><p>Od prvního hledání k prvnímu oslovení.</p><Button asChild className="action action-dark"><a href="/databaze/">Zobrazit databázi</a></Button></div></section>
      <section className="benefits-section dark-section" aria-labelledby="benefits-title"><div className="contours contours-dark" aria-hidden="true" /><div className="container benefits-grid"><div className="scale-block"><div className="big-number">32</div><p>firem pro váš<br />další velký obchod.</p><ul className="industry-tags" aria-label="Příklady oborů"><li>Výroba</li><li>Služby</li><li>Stavebnictví</li><li>a další</li></ul></div><div><h2 id="benefits-title">Vše podstatné.<br />Na jednom místě.</h2><div className="benefits-list">{benefits.map(item=><div className="benefit" key={item.title}><Icon name={item.icon} /><div><h3>{item.title}</h3><p>{item.text}</p></div></div>)}</div></div></div></section>
      <section id="jak-to-funguje" className="steps-section section container" aria-labelledby="steps-title"><h2 id="steps-title">Tři kroky.<br />Nové příležitosti.</h2><div className="steps-grid">{steps.map(step=><article className="step" key={step.title}><Icon name={step.icon} size={32} /><h3>{step.title}</h3><p>{step.text}</p></article>)}</div></section>
      <section id="cena" className="pricing-section" aria-labelledby="pricing-title"><div className="container pricing-grid"><div className="pricing-copy"><h2 id="pricing-title">Velká databáze.<br />Malá investice.</h2><p>Obchodní příležitosti mají být dostupné.<br className="desktop-break" /> Získejte přístup k českým firmám za cenu,<br className="desktop-break" /> která dává vašemu podnikání smysl.</p></div><div className="access-card"><h3>Odemkněte nové<br />příležitosti.</h3><ul>{['Ukázková databáze českých firem','Telefony, e-maily a webové stránky','Přehledné vyhledávání firem'].map(item=><li key={item}><Icon name="check" size={20} />{item}</li>)}</ul><AccessButton /></div></div></section>
      <section id="otazky" className="faq-section section container" aria-labelledby="faq-title"><div><h2 id="faq-title">Máte otázky?</h2><p>To podstatné na jednom místě.</p></div><div className="faq-list">{questions.map(([question,answer])=><article key={question}><h3>{question}</h3><p>{answer}</p></article>)}</div></section>
      <section className="closing-section dark-section" aria-labelledby="closing-title"><div className="container"><h2 id="closing-title">VÁŠ PŘÍŠTÍ KLIENT UŽ MOŽNÁ ČEKÁ.</h2><Button asChild className="action action-light"><a href="/databaze/">Najít nové zákazníky</a></Button></div></section>
    </main>
    <footer className="footer dark-section"><div className="container footer-content"><Logo plain /><p>České firmy. Nové příležitosti.</p><p>© {new Date().getFullYear()} Prospekto</p></div></footer>
  </>;
}
