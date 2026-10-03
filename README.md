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

Registrace začíná volbou zákazník / živnostník / firma. Člověk (users) je oddělený od účtu (accounts), členství a role (account_members) a veřejného profilu dodavatele. Hesla se ukládají jako solené scrypt hashe, session tokeny jako SHA-256 hashe. Cookies jsou HttpOnly, SameSite=Lax a na HTTPS také Secure; relace platí sedm dní. Server ověřuje uživatele a vlastníka uložených dat při každém požadavku. Identitní hlavičky z prohlížeče nejsou přihlašovacím mechanismem.

Existující účty této self-hosted verze zůstávají zachované. Migrace v2 zachová hesla, sessions, seznamy, kampaně, blokace a nastavení bota. Při dalším vstupu účty bez typu projdou výběrem a onboardingem. Účty z dřívějšího externího hostingu nejsou součástí této SQLite migrace. Ověřování e-mailových adres a samoobslužná obnova zapomenutého hesla zatím nejsou připojené. Přihlášení a registrace mají trvalé limity pokusů; aplikace neposílá registrační e-maily.

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

## Marketplace účty a onboarding (v2)

- **Zákazník:** /zakaznik/ — vlastní poptávky, nabídky, zprávy, hledání a oblíbení dodavatelé, recenze.
- **Živnostník:** /dodavatel/ — relevantní poptávky, leady, CRM pipeline, nabídky, zakázky, úkoly, kalendář, profil a statistiky.
- **Firma:** /firma/ — stejné dodavatelské funkce s odděleným účtem a členstvím týmu.
- **Administrátor platformy:** /administrace/ — pouze pro users.platform_role = PLATFORM_ADMIN. Tuto roli nelze zadat registrací ani přes veřejné API.
- /panel/ nyní pouze rozhoduje o správném prostředí. Původní databáze firem, seznamy, kampaně a bot jsou na /nastroje/ a jsou chráněné dodavatelskými oprávněními.
- /onboarding/ ukládá každý dokončený krok. Při přihlášení se pokračuje tam, kde uživatel skončil. Před dokončením server nepovolí chráněné obchodní API.
- Přepínač účtů nastavuje aktivní kontext v aktuální session. Členství se vždy ověřuje v databázi. Poslední zvolený účet se obnoví i po novém přihlášení.
- Další prostředí lze přidat bez odhlášení; původní účet a jeho data zůstanou zachované. Úpravy údajů jsou dostupné v Nastavení.
- COMPANY_OWNER a COMPANY_ADMIN upravují podnikatelský profil a nastavení bota; COMPANY_MEMBER pracuje s firemními leady, poptávkami a obchodními daty, ale nemění profil a nastavení.
- Veřejné profily na /dodavatele/[id]/ zobrazují pouze publikované údaje dokončených dodavatelů. Fakturační adresy a osobní kontakty členů nejsou veřejné.

### Migrace a nasazení

Tato změna vychází z aktuálního GitHub main, který používá **SQLite (node:sqlite), nikoliv PostgreSQL**. Nemění databázový engine. Přechod na PostgreSQL vyžaduje samostatnou migraci připojení i stávajících dat.

Před aktualizací zastavte původní aplikaci a zazálohujte DATABASE_PATH včetně WAL/SHM, pokud existují. Zachovejte stejnou trvalou cestu DATABASE_PATH. Příkaz npm run build / pnpm build automaticky aplikuje verzovanou migraci; aplikace ji ověří také při prvním soukromém požadavku. Migrace probíhá v jedné transakci a lze ji opakovat.

Migrace nikdy nemaže uživatele ani obchodní záznamy. Původní owner_id zůstává jako původ záznamu; autorizace obchodních dat nově používá account_id. Nastavení bota je převedeno beze změny obsahu na klíč účtu. Starší účty začínají bez typu a bez dokončeného onboardingu.

Nespouštějte současně starou a novou verzi proti stejnému databázovému souboru. Návrat na v1 vyžaduje obnovení zálohy; původní migrační ochrana odmítá novější schéma.

### Datový model

Sdílené podnikatelské údaje jsou v provider_profiles. company_profiles obsahuje pouze firemní doplňky (rok založení a reference). Služby, specializace, oblast působnosti, portfolio, poptávky, leady, nabídky, zprávy, recenze a úkoly mají vlastní tabulky. subscriptions a credit_entries připravují účetní hranici pro Pro a kredity; v této verzi nespouštějí platby ani účtování.

Fotografie JPG/PNG/WebP do 2 MB se ukládají do soukromé databáze; veřejně jsou dostupné jen obrázky skutečně přiřazené dokončenému profilu. Do zálohy databáze proto patří i fotografie. Maximum je 60 nahraných obrázků na účet a 12 položek portfolia.

### Rozsah první verze

Funguje základní tok poptávka → zájem dodavatele → lead → nabídka → výběr dodavatele → dokončení → recenze a zprávy mezi účastníky. CRM má ruční leady, změny stavů a úkoly. Statistiky dodavatele se počítají z databáze.

Párování nyní používá služby, přesně zadaná města, vybrané kraje nebo celou republiku. Dojezd v km a souřadnice jsou připravené v modelu; přesné párování v okruhu vyžaduje budoucí geokódovací adaptér. Ověřování IČO má samostatnou serverovou hranici v lib/accounts/verification.ts a stav UNVERIFIED. Externí registr zatím není připojený.

Členství, role a sdílená firemní data fungují; pozvánky a samoobslužná správa týmu se doplní později. UI vypisuje nejvýše 200 poptávek/dodavatelů a 500 leadů/konverzací; před velkým marketplace doplňte serverové stránkování a fulltext. E-mailové notifikace, platby a kredity zatím nejsou aktivní.

### Ověření

Spusťte npm run build, npm run typecheck, npm test. GitHub workflow Verify Prospekto spouští stejné kontroly na izolované databázi. Test npm run test:migration lze spustit samostatně a ověřuje migraci skutečného schématu v1, zachování dat, cizí klíče a opakovatelnost. Integrační testy ověřují všechny typy účtů, nedokončený onboarding, role, izolaci dat, přepínání kontextů, marketplace tok a zachování původních nástrojů.


## Pracovní nabídky (schéma v3)

Pracovní pozice tvoří samostatnou sekci /prace/, oddělenou od zákaznických poptávek. Zaměstnavatelé spravují inzeráty na /zamestnavatel/prace/. Název firmy a IČO se odvozují od aktivního podnikatelského účtu; nelze je podvrhnout v inzerátu.

Inzerát obsahuje název pozice, obor, zaměstnavatele, město/kraj/adresu, typy spolupráce, režim práce, hrubou mzdu nebo odměnu v Kč od–do za hodinu/měsíc/rok, představení, náplň práce, požadavky, benefity, vzdělání, praxi, jazyky, vhodnost pro absolventy/OZP, nástup, kontakt a platnost. Webový detail obsahuje JSON-LD JobPosting.

Katalog kombinuje hledání pozice/firmy/města, obor, kraj, druh spolupráce, práci na dálku, absolventy a minimální nabízenou měsíční mzdu. Mzdový filtr porovnává horní hranici uvedeného rozpětí (nebo jedinou zadanou částku); nabídky s jiným obdobím nebo bez mzdy do něj nezahrnuje. Stránkování má 20 záznamů.

SELF_EMPLOYED, COMPANY_OWNER a COMPANY_ADMIN mohou vytvořit, upravit, zveřejnit a ukončit nabídku svého účtu. Koncepty, ukončené a prošlé nabídky nejsou veřejné. COMPANY_MEMBER nemůže upravovat nábor ani číst osobní údaje uchazečů.

Dokončený zákaznický účet může reagovat zprávou, telefonem a volitelným HTTPS odkazem na životopis. E-mail je převzatý z přihlášeného účtu. Reakce vidí pouze příslušný uchazeč a oprávnění správci zaměstnavatele. Přehled zákazníka je na /moje-reakce/. Jedna reakce na nabídku a zákaznický účet; žádné automatické e-maily se neodesílají.

Migrace v3 pouze přidává tabulky job_postings a job_applications a jejich indexy. Předchozí účty a obchodní data zachovává. Koncept i publikovaný inzerát vyžadují vyplněné základní údaje a alespoň jeden kontakt. Datum platnosti je včetně uvedeného dne (UTC).

Nabídky jsou vlastní obsah zaměstnavatelů v Prospektu. Není zapojený import, scraping ani synchronizace Jobs.cz a nejsou předvyplněné fiktivní inzeráty skutečných firem. Struktura připomíná běžný pracovní portál. Jednotlivý účet může spravovat nejvýše 500 inzerátů; přehled reakcí načítá posledních 1000 odpovědí.



## Poptávky, přímé nabídky a messenger (v4)

Poptávky mají dva explicitní režimy: Všechny poptávky a Doporučené pro vás. První neomezuje obor ani lokalitu podle profilu; druhý používá stávající párování. Vyhledávání, obor včetně podkategorií a kraj se kombinují na serveru před stránkováním po 20 záznamech. Přehled nadále ukazuje doporučené poptávky.

Živnostník i firemní člen mohou poslat nabídku přímo z karty otevřené poptávky. Server v jedné transakci založí případný chybějící lead, uloží nabídku a připraví kontakt ve Zprávách. Uzavřené a již přidělené poptávky nabídky nepřijímají. Nabídky jsou dostupné v hlavní navigaci dodavatele, z leadů i přímo u poptávky.

Messenger používá jednu konverzaci mezi dvěma účty, i když spolu řeší více poptávek. Má hledání kontaktů, přímé zprávy z veřejného profilu dodavatele, nepřečtené zprávy, průběžné načítání (4–5 sekund při otevřené kartě), chronologii a načítání starší historie po 50 zprávách. Enter odesílá, Shift + Enter vloží nový řádek. Na mobilu se přepíná seznam kontaktů a otevřený chat. Rozepsané zprávy zůstávají při přepnutí chatu v paměti stránky; po opuštění stránky se neukládají.

Oprávnění se vždy ověřují proti aktivnímu účtu na serveru. Osobní účty nemají veřejný adresář: dodavatel může oslovit zákazníka ze svých leadů nebo existující konverzace. Veřejné dodavatelské účty lze oslovit přímo. Konverzace firem jsou společné jejím oprávněným členům. Přehled načítá posledních 500 konverzací, hledání nového kontaktu nejvýše 50 výsledků. Odesílání má limit 30 zpráv za minutu na účet; opakování stejného odeslání se stejným ID zprávu nezdvojí. Přílohy a e-mailová upozornění nejsou v této verzi.

Migrace v4 přidává conversations a conversation_reads a převádí původní messages do společných konverzací. Zachovává ID, autora, text, čas i vazbu každé starší zprávy na poptávku; kopírování a výměna tabulky probíhají uvnitř stejné transakce. Před aktualizací zachovejte zálohu databáze dle postupu výše. Návrat ke kódu se schématem v3 vyžaduje obnovu odpovídající zálohy.
