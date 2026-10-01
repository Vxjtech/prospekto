import {AuthPage} from '@/components/panel/auth-page';
export const dynamic='force-dynamic';
export const metadata={title:'Přihlášení | Prospekto',robots:{index:false,follow:false}};
export default function Page(){return <AuthPage login/>;}
