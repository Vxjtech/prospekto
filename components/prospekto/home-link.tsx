import {House} from 'lucide-react';

export function HomeLink({className=''}:{className?:string}){
 // A native navigation also works before the app's JavaScript has loaded.
 // eslint-disable-next-line @next/next/no-html-link-for-pages
 return <a href="/" className={`home-link ${className}`}><House size={16} aria-hidden="true"/>Zpět na úvod</a>;
}
