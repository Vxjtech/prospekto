import {Button} from '@/components/ui/button';
import {offer} from '@/lib/offer';
export function AccessButton(){return <>{offer.priceCzk!==null&&<p className="offer-price">{new Intl.NumberFormat('cs-CZ',{style:'currency',currency:'CZK',maximumFractionDigits:0}).format(offer.priceCzk)}</p>}<Button asChild className="action action-primary access-button"><a href="/registrace/">Vytvořit účet a otevřít panel</a></Button><p style={{fontSize:12,marginTop:14,textAlign:'center'}}>Vytvořte si účet pro přístup ke kontaktům a uloženým seznamům.</p></>;}
