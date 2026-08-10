# AutoParts Pro

Modern, Docker-alapú autóalkatrész-webshop Next.js + NestJS + PostgreSQL + Prisma alapon. Lokálisan fizetős külső szolgáltatás nélkül kipróbálható; a külső katalógus-, fizetési és futárszolgáltatások adapterezettek, a fejlesztői folyamat mock megoldásokkal működik.

## Egyparancsos indítás

```bash
docker compose up --build
```

A `.env` fájl opcionális. Saját beállításhoz:

```bash
cp .env.example .env
```

A Compose induláskor megvárja a PostgreSQL/Redis/MinIO/Mailpit healthcheckeket, lefuttatja a Prisma generálást, migrációt és az idempotens seedet, majd elindítja az API-t és a webet.

## Fontos URL-ek

- Webshop: http://localhost:3000
- Admin dashboard: http://localhost:3000/admin
- Admin rendelések: http://localhost:3000/admin/orders
- Admin termékek: http://localhost:3000/admin/products
- Raktár: http://localhost:3000/warehouse
- REST API: http://localhost:4000/api
- Swagger/OpenAPI: http://localhost:4000/docs
- Mailpit: http://localhost:8025
- MinIO Console: http://localhost:9001

## Demo fiókok – kizárólag lokális seed

| Szerepkör | E-mail | Jelszó |
|---|---|---|
| Vásárló | customer@autoparts.local | Demo1234! |
| Raktáros | warehouse@autoparts.local | Demo1234! |
| Ügyfélszolgálat | support@autoparts.local | Demo1234! |
| Admin | admin@autoparts.local | Demo1234! |
| Szuperadmin | superadmin@autoparts.local | Demo1234! |

## Architektúra és adatmodell

- `apps/web`: Next.js 16 App Router, TypeScript, Tailwind CSS, reszponzív magyar webshop/admin/raktári felület.
- `apps/api`: NestJS 11 REST API, Swagger, DTO-validáció, HttpOnly cookie auth, backend RBAC.
- PostgreSQL + Prisma: felhasználók, címek, vásárlói árcsoportok, járműkatalógus, kompatibilitás, termékek/variánsok/dokumentumok, kategóriák, promóciók, kosár, rendelések, visszáruk, rendszerbeállítások és audit.
- Készlet: `InventoryBalance` + változtathatatlan `InventoryMovement` főkönyv. Checkoutkor több raktárból is atomi foglalás, csomagoláskor `SALE`, lemondáskor `RELEASE`, továbbá bevételezés, leltárkorrekció, selejt, visszáru és tranzakciós raktárközi átadás.
- Rendelés: külön `OrderStatusHistory`, szabályozott állapotgép és rendeléstétel-pillanatképek.
- MinIO: JPG/PNG/WebP termékkép-feltöltés legfeljebb 5 MB, PDF termékdokumentum legfeljebb 10 MB; MIME mellett fájl-aláírás ellenőrzéssel.
- Redis: brute-force/rate-limit számlálók és újrapróbálható háttér e-mail queue.
- Mailpit: regisztrációs megerősítés, jelszó-visszaállítás, rendelés- és állapotértesítések fejlesztői e-mailjei.

### Jogosultsági mátrix

| Funkció | Vásárló | Raktáros | Ügyfélszolgálat | Admin | Szuperadmin |
|---|:---:|:---:|:---:|:---:|:---:|
| Saját profil/kosár/rendelés | ✓ | – | – | – | ✓ |
| Készlet olvasás/módosítás | – | ✓ | – | olvasás | ✓ |
| Rendelés ügyintézés | – | raktári lépések | ✓ | ✓ | ✓ |
| Termék/promóció kezelés | – | – | – | ✓ | ✓ |
| Felhasználók/riport | – | – | – | ✓ | ✓ |
| Szerepkör/rendszer/audit | – | – | – | – | ✓ |

A mátrix nem csak UI-szintű: a védett API műveletek `JwtGuard` + `RolesGuard` ellenőrzést kapnak.

## Seed tartalom

- 10 autómárka, márkánként több modell, generáció és motor;
- 8-nál több hierarchikus alkatrészkategória;
- 50 saját demonstrációs mintatermék és saját SVG placeholder;
- OEM/alternatív cikkszámok és demonstrációs jármű-kompatibilitás;
- két raktár, változó készletszintek, sérült/várható készlet;
- automatikus gyártói akció, `NYAR10` kupon és vásárlói árcsoport;
- többféle állapotú mintarendelések és minden szerepkörhöz demo felhasználó.

## Fő folyamatok

1. Belépés vagy e-mail-megerősítéses regisztráció.
2. Autó kiválasztása márka → modell → generáció → motor szerint.
3. Terméklista kompatibilitási szűréssel, SKU/OEM/alternatív szám kereséssel.
4. Vendég- vagy bejelentkezett kosár, automatikus prioritásos akciók és `NYAR10` lokális demo kupon.
5. Vendégként vagy fiókkal checkout: utánvét, átutalás vagy mock bankkártya; házhoz, csomagpontra vagy személyes átvétel.
6. Serializable DB tranzakcióban készletfoglalás és rendelés-pillanatkép.
7. Raktáros: feldolgozás → komissiózás → csomagolás; csomagoláskor a foglalás tényleges készletcsökkentéssé válik.
8. Admin/support: rendelési állapotok, megjegyzések, visszáruk; a mock futár feladáskor követési számot ad.
9. Vásárló: címek, garázs, adat-export/anonimizálás, újrarendelés, értékelés, visszáru és fejlesztői számlaadat.

## Admin funkciók

- termék létrehozás/szerkesztés/másolás/archiválás;
- kategória és gyártó kezelés;
- kép feltöltés MinIO-ra, kép hozzárendelés/törlés/sorrend/főkép;
- variánsok;
- CSV export, import-előnézet és import;
- tömeges státusz, készletküszöb, kategória és árszorzó;
- prioritásos automatikus termék-/kategória-/gyártó-/kosárakciók és kuponok;
- vásárlói árcsoportok;
- kapcsolódó, helyettesítő és csomagtermék-kapcsolatok;
- PDF termékdokumentumok;
- szuperadmin rendszerbeállítás- és telephelykezelés;
- rendelés, felhasználó, review, visszáru, audit lista;
- napi/heti/havi bevétel, AOV, top termék, alacsony készlet, függő rendelés, kupon és visszáru mutatók.

## Külső integrációk

A projekt tartalmaz interfészeket külső katalógushoz, fizetéshez és futárhoz. Lokálisan mock megoldások használhatók. Stripe/Barion/SimplePay/GLS/MPL/Foxpost vagy licencelt járműkatalógus csak külön adapterrel és környezeti kulccsal aktiválható; titok nem kerül a repositoryba. A mock fizetési webhook HMAC-aláírást ellenőriz és `providerEventId` alapján idempotens.

## Ellenőrzés

```bash
npm install
npm run prisma:generate -w @autoparts/api
npm run lint
npm run typecheck
npm test
npm run build
# Futó Docker stack mellett:
npm run test:integration
npm run test:e2e
```

A `.github/workflows/ci.yml` ugyanezt automatizálja. A Dockeres ellenőrzés HTTP backend-integrációs tesztet, majd Playwright folyamatokat futtat: regisztráció/login, RBAC, kompatibilitás, kosár/kupon, termék+kép, párhuzamos készletfoglalás, lemondás/készlet-visszaadás, raktári komissiózás/csomagolás, készletmozgás, visszáru, aláírt-idempotens webhook, bejelentkezett és vendég checkout/rendeléskövetés.

## Jogi megjegyzés

Az ÁSZF-, adatvédelmi-, süti-, szállítási- és elállási oldalak konfigurálható fejlesztői minták. A projekt **nem állít teljes magyar vagy EU jogi megfelelőséget**; éles publikálás előtt a tényleges kereskedői és szolgáltatói működés alapján jogi felülvizsgálat szükséges.
