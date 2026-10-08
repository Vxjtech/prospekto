import { getPublicCompanies } from '@/lib/companies';
import { Header } from '@/components/prospekto/header';
import { Logo } from '@/components/prospekto/logo';
import { Icon } from '@/components/prospekto/icon';
import { CompanyBrowser } from '@/components/prospekto/company-browser';
import type { Metadata } from 'next';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Prospekto — Práce, poptávky a databáze firem',
  description: 'Najděte pracovní pozici, získejte novou zakázku nebo oslovte firmy. Prospekto propojuje lidi a podnikatele na jednom místě.',
  openGraph: {
    title: 'Prospekto — Práce, zakázky a kontakty. Na jednom místě.',
    description: 'Pracovní pozice, poptávky od lidí i firem a databáze českých firem. Najděte svou další příležitost.',
    locale: 'cs_CZ',
    type: 'website',
  },
};

const benefits = [
  { icon: 'search' as const, title: 'Pracovní pozice', text: 'Hledáte práci nebo nové kolegy? Prohlížejte pracovní nabídky nebo představte svou volnou pozici uchazečům.' },
  { icon: 'target' as const, title: 'Poptávky a nové zakázky', text: 'Potřebujete dodavatele? Zadejte poptávku. Podnikáte? Nabídněte své služby lidem i firmám a získejte přístup ke kontaktování zákazníka.' },
  { icon: 'globe' as const, title: 'Databáze českých firem', text: 'Najděte potenciální zákazníky i obchodní partnery. Vyhledávejte podle oboru a kraje a prohlédněte si dostupné kontakty.' },
];
const steps = [
  { icon: 'search' as const, title: 'Vyberte si příležitost.', text: 'Nová práce, zakázka nebo obchodní partner? Vyberte si, co právě hledáte.' },
  { icon: 'list' as const, title: 'Najděte, co vám sedí.', text: 'Prohlédněte si pracovní pozice, poptávky nebo firmy. Zaměřte se na obor a místo, které vás zajímají.' },
  { icon: 'target' as const, title: 'Udělejte první krok.', text: 'Reagujte na pracovní nabídku, nabídněte řešení poptávky nebo oslovte vybranou firmu.' },
];
const questions = [
  ['Co na Prospektu najdu?', 'Pracovní pozice, poptávky od soukromých osob i firem a databázi českých firem. Ať hledáte zaměstnání, zakázky nebo obchodní kontakty, začít můžete na jednom místě.'],
  ['Pro koho je Prospekto určené?', 'Pro lidi hledající práci nebo dodavatele i pro živnostníky a firmy, kteří chtějí získávat zakázky, hledat kolegy nebo navazovat spolupráci.'],
  ['Jak fungují poptávky?', 'Zákazník popíše, co potřebuje, a dodavatelé mu mohou zdarma poslat nabídku. Po přijetí nabídky zákazníkem si dodavatel může za kredity odemknout společný chat a domluvit podrobnosti.'],
  ['Může poptávku zadat i firma?', 'Ano. Poptávku může vytvořit soukromá osoba i účet s IČO. Jako podnikatel tak můžete na stejném účtu získávat zakázky i hledat dodavatele pro vlastní projekt.'],
  ['Jaké údaje najdu v databázi firem?', 'Firemní profily a dostupné telefony, e-maily nebo webové stránky. Rozsah údajů se u každé firmy liší. Názvy firem si prohlédnete veřejně, kontakty jsou dostupné po přihlášení.'],
];

export const dynamic='force-dynamic';

export default async function Home() {
  const database=await getPublicCompanies().catch(()=>null);
  return <>
    <a className="skip-link" href="#obsah">Přejít na obsah</a>
    <div className="hero-shell" id="nahoru"><div className="contours contours-light" aria-hidden="true" /><Header />
      <section className="hero container" aria-labelledby="hero-title"><h1 id="hero-title">PRÁCE. ZAKÁZKY. KONTAKTY.<br />NA JEDNOM MÍSTĚ.</h1><p className="hero-description">Najděte novou práci, získejte zakázky z poptávek<br className="desktop-break" /> nebo oslovte firmy. S Prospektem máte kde začít.</p><div className="hero-actions"><Button asChild className="action action-primary"><a href="/prace/">Najít práci</a></Button><Button asChild className="action action-light"><a href="/registrace/">Získat zakázky</a></Button></div><p className="hero-footnote">Pro lidi, živnostníky i firmy. Od nové práce po dlouhodobou spolupráci.</p></section>
    </div>
    <main id="obsah">
      <section className="proof-strip container" aria-label="Prospekto v kostce"><div><strong>{database?.catalogTotal.toLocaleString('cs-CZ')??'—'}</strong><span>firem v databázi</span></div><div className="proof-contacts"><strong>Pracovní pozice</strong><span>Pro uchazeče i zaměstnavatele</span></div><div><strong>Poptávky</strong><span>Od soukromých osob i firem</span></div></section>
      <section id="databaze" className="database-section section container" aria-labelledby="database-title"><div className="section-intro"><h2 id="database-title">Správná firma.<br />Nová spolupráce.</h2><p>Hledejte zákazníky, dodavatele i partnery.<br className="desktop-break" /> Prohlédněte si názvy firem bez registrace.<br className="desktop-break" /> Kontakty odemknete po přihlášení.</p></div>{database?<CompanyBrowser initialData={database}/>:<p role="alert">Databázi se nepodařilo načíst. Zkuste stránku obnovit.</p>}<div className="database-bottom"><p>Vyberte obor a kraj. Najděte firmy, které chcete oslovit.</p><Button asChild className="action action-dark"><a href="/databaze/">Zobrazit databázi</a></Button></div></section>
      <section className="benefits-section dark-section" aria-labelledby="benefits-title"><div className="contours contours-dark" aria-hidden="true" /><div className="container benefits-grid"><div className="scale-block"><div className="big-number">3</div><p>cesty k vaší<br />další příležitosti.</p><ul className="industry-tags" aria-label="Co Prospekto nabízí"><li>Práce</li><li>Poptávky</li><li>Databáze firem</li></ul></div><div><h2 id="benefits-title">Co právě hledáte?</h2><div className="benefits-list">{benefits.map(item=><div className="benefit" key={item.title}><Icon name={item.icon} /><div><h3>{item.title}</h3><p>{item.text}</p></div></div>)}</div></div></div></section>
      <section id="jak-to-funguje" className="steps-section section container" aria-labelledby="steps-title"><h2 id="steps-title">Tři kroky.<br />Nové příležitosti.</h2><div className="steps-grid">{steps.map(step=><article className="step" key={step.title}><Icon name={step.icon} size={32} /><h3>{step.title}</h3><p>{step.text}</p></article>)}</div></section>
      <section id="cena" className="pricing-section" aria-labelledby="pricing-title"><div className="container pricing-grid"><div className="pricing-copy"><h2 id="pricing-title">Práce i podnikání.<br />Začněte u nás.</h2><p>Hledáte práci, potřebujete dodavatele,<br className="desktop-break" /> nebo chcete rozvíjet své podnikání?<br className="desktop-break" /> Vytvořte si účet podle toho, co potřebujete.</p></div><div className="access-card"><h3>Odemkněte nové<br />příležitosti.</h3><ul>{['Pracovní nabídky pro váš další krok','Poptávky a příležitosti k novým zakázkám','Databáze firem pro navázání spolupráce'].map(item=><li key={item}><Icon name="check" size={20} />{item}</li>)}</ul><Button asChild className="action action-primary access-button"><a href="/registrace/">Vytvořit účet</a></Button><p style={{fontSize:12,marginTop:14,textAlign:'center'}}>Soukromá osoba nebo účet s IČO. Vyberete si při registraci.</p></div></div></section>
      <section id="otazky" className="faq-section section container" aria-labelledby="faq-title"><div><h2 id="faq-title">Máte otázky?</h2><p>To podstatné na jednom místě.</p></div><div className="faq-list">{questions.map(([question,answer])=><article key={question}><h3>{question}</h3><p>{answer}</p></article>)}</div></section>
      <section className="closing-section dark-section" aria-labelledby="closing-title"><div className="container"><h2 id="closing-title">VAŠE DALŠÍ PŘÍLEŽITOST ZAČÍNÁ TADY.</h2><Button asChild className="action action-light"><a href="/registrace/">Začít s Prospektem</a></Button></div></section>
    </main>
    <footer className="footer dark-section"><div className="container footer-content"><Logo plain /><p>Práce. Zakázky. Kontakty.</p><p>© {new Date().getFullYear()} Prospekto</p></div></footer>
  </>;
}
