# Prospekto — vlastní Node.js server

Samostatná aplikace v Next.js a Reactu. Obsahuje landing page, veřejné demo, registraci e-mailem a heslem a soukromý panel. Cloudflare, D1, Workers, Wrangler, Vinext ani přihlášení přes ChatGPT nejsou potřeba.

## Rychlé spuštění

Použijte **Node.js 24 LTS** a **pnpm 11.25.0**:

```sh
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm install --frozen-lockfile
cp .env.example .env
pnpm dev
```

Aplikace běží na `http://localhost:3000`. Pro produkci:

```sh
pnpm build
pnpm start
```

Před spuštěním nastavte v `.env`:

```dotenv
APP_URL=https://vase-domena.cz
DATABASE_PATH=/absolutni/cesta/k/trvalym-datum/prospekto.sqlite
```

`APP_URL` musí odpovídat adrese v prohlížeči, včetně protokolu a případného portu. Používá se pro ochranu zápisů a nastavení zabezpečených cookies. Za reverzní proxy nastavte veřejnou HTTPS adresu; spojení mezi proxy a Node.js může být HTTP. Vývoj na HTTP localhostu funguje s výchozí `.env.example`.

`pnpm start` ponechává běžet Node.js server. Na VPS jej spravujte například pomocí systemd, případně použijte Docker níže. Jde o serverovou aplikaci, nikoliv statický export pro obyčejný souborový hosting.

## Docker

Přiložený Dockerfile sestaví Next.js do režimu `standalone`. Docker Compose uchovává databázi v pojmenovaném svazku.

```sh
cp .env.example .env
# Upravte APP_URL v .env na veřejnou adresu webu.
docker compose up -d --build
```

Výchozí port je dostupný na `127.0.0.1:3000` serveru, aby před aplikací mohla běžet lokální HTTPS reverzní proxy. Pokud proxy běží v jiné Docker síti, upravte síťování podle svého serveru. Databázový svazek `prospekto-data` zachovejte i při dalších nasazeních; příkaz `docker compose down -v` by jej odstranil.

## Firmy a uložená data

- Katalog firem se načítá pouze pro čtení ze souboru `data/companies.sqlite3`; cesta se nastavuje přes `COMPANIES_DATABASE_PATH`.
- Zdroj obsahuje tabulky `companies` a `company_categories`. Pole `phones`, `emails` a `websites` jsou JSON pole; veřejné API skrývá IČO i kontakty.
- Zdroj obsahuje 245 828 firem a oborové kategorie. Neobsahuje město ani kraj, proto je filtr krajů vypnutý.
- Při Docker buildu musí být `data/companies.sqlite3` přítomný; soubor se zkopíruje do image mimo svazek účtů.
- Účty, relace, seznamy, koncepty, blokace a nastavení bota se ukládají do lokální SQLite databáze. Výchozí umístění je `data/prospekto.sqlite`.
- Databázový soubor účtů i jeho tabulky se vytvoří **automaticky při buildu**; při prvním spuštění se případné migrace bezpečně doplní. Výchozí umístění je `data/prospekto.sqlite`.
- Adresář databáze musí být zapisovatelný uživatelem serveru a trvalý mezi nasazeními. Neukládejte jej do `public/` nebo `.next/`.
- Toto řešení je určené pro jeden Node.js server s lokálním diskem. Pro více nezávislých serverů zvolte sdílenou serverovou databázi.

Pro zálohu zastavte aplikaci a zkopírujte celý datový adresář včetně případných souborů `-wal` a `-shm`; alternativou je SQLite online backup. Při obnově zachovejte oprávnění k souborům. Uživatelská data ani hesla nepatří do Gitu.

## Účty

Registrace používá e-mail, heslo, jméno a pracovní prostor. Hesla se ukládají jako solené scrypt hashe, session tokeny jako SHA-256 hashe. Cookies jsou HttpOnly, SameSite=Lax a na HTTPS také Secure; relace platí sedm dní. Server ověřuje uživatele a vlastníka uložených dat při každém požadavku. Identitní hlavičky z prohlížeče nejsou přihlašovacím mechanismem.

Staré účty z původního hostingu se automaticky nepřenášejí; na vlastním serveru si uživatelé založí nové účty. Ověřování e-mailových adres a samoobslužná obnova zapomenutého hesla zatím nejsou připojené. Přihlášení a registrace mají trvalé limity pokusů; aplikace neposílá registrační e-maily.

## Panel a e-mailový bot

Panel obsahuje kontakty, uložené seznamy, koncepty kampaní, blokace a nastavení bota. Náhledy a export `.eml` fungují. SMTP transport, ukládání SMTP hesel, automatické rozesílání a platby nejsou připojené; aplikace sama e-maily neodesílá.

## Ověření a struktura

```sh
pnpm build
pnpm typecheck
pnpm test
```

Test spustí produkční standalone server s izolovanou dočasnou databází. Ověřuje registraci, přihlášení, odhlášení, izolaci účtů, ochranu veřejných kontaktů, filtry, ukládání a zachování dat po restartu. Nedotýká se produkční databáze.

- `app/`, `components/` — stránky, API a React komponenty.
- `lib/auth.ts` — účty a relace; `lib/http.ts` — kontrola původu a velikosti požadavků.
- `lib/companies.ts`, `lib/company-types.ts` — read-only firemní katalog a jeho mapování.
- `db/index.ts`, `db/schema.ts` — SQLite a automatické verzované schéma.
- `lib/panel/` — uživatelská data a kontrola vlastnictví.
- `public/` — loga, ikony a další veřejné soubory.

Vizuální styl Prospekta, písmo Manrope a zelená paleta zůstávají zachované.
