# Prospekto — zdrojový kód

Export zveřejněné verze 13 ze dne 1. 10. 2026.
Zdrojový commit: `6065e2c3d52aab3dcf09f2db134737538e2942f9`.
Aplikační soubory odpovídají tomuto commitu; tento návod byl aktualizován pro předání zdrojů. Generovaná TypeScript cache není součástí exportu.

## Technologie

Next.js App Router, React 19, TypeScript, Tailwind CSS, Drizzle ORM a Cloudflare D1. Produkční server používá Vinext a Cloudflare Workers. Současná publikovaná aplikace běží na Sites a využívá jeho přihlášení přes ChatGPT.

## Instalace a spuštění

Potřebujete Node.js 22.13 nebo novější a pnpm 11.25.0.

```sh
cd prospekto
pnpm install --frozen-lockfile
```

Před prvním spuštěním je potřeba vytvořit lokální databázové tabulky. V kořeni projektu vytvořte `wrangler.local.json`:

```json
{
  "name": "prospekto-local",
  "main": "build/sites-worker.ts",
  "compatibility_date": "2026-05-15",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [{
    "binding": "DB",
    "database_name": "site-creator-d1",
    "database_id": "00000000-0000-4000-8000-000000000000",
    "migrations_dir": "drizzle"
  }]
}
```

Potom spusťte:

```sh
pnpm exec wrangler d1 migrations apply DB --local --config wrangler.local.json --persist-to .wrangler/state
pnpm dev
```

Vývojová adresa je `http://localhost:5173`. Lokální vývoj používá testovací přihlášení omezené na localhost. Bez importovaných dat se zobrazí 32 výslovně ukázkových firem. Lokální databáze je oddělená od zveřejněného webu.

Další příkazy:

```sh
pnpm typecheck
pnpm build
node scripts/test-panel.mjs
```

Build vytváří server a klientské soubory v `dist/`. Integrační test pracuje s vlastní dočasnou databází; poslední ověření této verze úspěšně prošlo 82 kontrolami. Export ZIP byl zkontrolován na úplnost, celý vývojový postup na novém počítači nebyl znovu spuštěn.

## Orientace ve zdrojích

- `app/` — landing page, veřejná databáze, přihlášení, registrace, panel a API.
- `components/prospekto/` — veřejný web, logo a prohlížeč databáze.
- `components/panel/` — kontakty, seznamy, koncepty kampaní a nastavení bota.
- `lib/companies.ts` — serverové dotazy, hledání a stránkování skutečné databáze.
- `lib/panel/` — uživatelská data a kontrola vlastnictví.
- `db/schema.ts`, `drizzle/` — schéma a databázové migrace, včetně fulltextového indexu.
- `scripts/import-catalog.py` — import původního SQLite souboru po obnovitelných dávkách.
- `scripts/test-panel.mjs` — integrační kontroly.
- `public/` — loga, ikony a další veřejné soubory.

## Databáze

Na zveřejněném webu je importováno 245 828 firem. E-mail má 229 533 firem, telefon 238 803 a web 200 928. Firmy mohou mít více kontaktů a kategorií. Zdroj neobsahuje města ani kraje, proto je regionální filtr pro tento dataset neaktivní.

ZIP obsahuje zdrojový kód, schéma a importní skript. Neobsahuje původní `kontakty(1).sqlite3`, produkční databázi, účty uživatelů ani jejich uložené seznamy. Pro vlastní import použijte samostatně původní SQLite soubor. Přípravu dávek lze spustit pomocí Pythonu 3.11+:

```sh
python scripts/import-catalog.py /cesta/ke/kontakty.sqlite3 --prepare-only
```

Importér je účelově nastavený pro dodaný soubor a současnou adresu Prospekta. Při přesunu na vlastní hosting upravte jeho cílovou adresu a autorizaci. V původním projektu už byl import dokončen a jeho jednorázový tajný klíč odstraněn. Příprava dávek sama nic nenahrává. Plný import vyžaduje serverově nastavený `CATALOG_IMPORT_TOKEN`; tento klíč v ZIP není.

Veřejné API vrací jen ID, název, kategorii a kraj. Kontaktní údaje a IČO jsou dostupné přes soukromé API po ověření přihlášení a dokončeného profilu. Soukromé odpovědi se neukládají do sdílené cache.

## Hosting a přihlášení

Tento export je zdroj současné aplikace pro Sites, nikoliv hotová migrace na jiný hosting. `.openai/hosting.json` identifikuje původní projekt; neobsahuje heslo ani přístupový token. Sites poskytuje produkční databázi a důvěryhodné identitní hlavičky. Samotné rozbalení ZIP neuděluje přístup k produkčním datům.

Při nasazení mimo Sites je nutné připojit vlastní databázi a přihlášení a upravit `app/chatgpt-auth.ts`, přihlašovací cesty a konfiguraci serveru. Veřejný server nesmí důvěřovat identitním hlavičkám zaslaným návštěvníkem. Pouhé vystavení současného Workeru bez vrstvy ověřující identitu není kompletní samostatné nasazení.

## Stav e-mailového bota a plateb

Panel umí ukládat koncepty kampaní, seznamy, blokace a konfiguraci bota, vytvářet náhledy a exportovat `.eml`. Skutečný SMTP transport, bezpečné ukládání SMTP tajných údajů a automatické rozesílání nejsou připojené. Aplikace e-maily sama neodesílá. Platby ani placená oprávnění zatím nejsou implementované; přístup ke kontaktům je podmíněn registrací a přihlášením.

## Design

Písmo Manrope, pistáciová `#B8EA8D`, lesní `#18251D`, pozadí `#F7F9F4`, šalvějová `#E8EFE3` a doplňkový text `#647160`. Veřejné styly jsou v `app/globals.css`, styly panelu v `app/panel/panel.css`.
