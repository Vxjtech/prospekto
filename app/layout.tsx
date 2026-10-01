import type {Metadata} from 'next';
import '@fontsource-variable/manrope';
import './globals.css';
export const metadata:Metadata={title:'Prospekto — České firmy. Nové příležitosti.',description:'240 000+ českých firem. Telefony, e-maily a webové stránky přehledně na jednom místě pro vaše B2B nabídky.',icons:{icon:'/favicon.svg?v=20260930-p',shortcut:'/favicon.svg?v=20260930-p'},openGraph:{title:'Prospekto — Vaši další klienti už jsou tady.',description:'Databáze českých firem pro vaše B2B nabídky.',locale:'cs_CZ',type:'website'}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="cs"><body>{children}</body></html>;}
