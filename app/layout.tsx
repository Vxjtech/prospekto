import type {Metadata} from 'next';
import '@fontsource-variable/manrope';
import './globals.css';
export const metadata:Metadata={title:'Prospekto — České firmy. Nové příležitosti.',description:'Hledejte firmy, prohlížejte si kontakty a spravujte vlastní obchodní seznamy.',icons:{icon:'/favicon.svg?v=20260930-p',shortcut:'/favicon.svg?v=20260930-p'},openGraph:{title:'Prospekto — Vaši další klienti už jsou tady.',description:'Databáze českých firem pro vaše B2B nabídky.',locale:'cs_CZ',type:'website'}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="cs"><body>{children}</body></html>;}
