# AutoParts Pro – rövid megvalósítási terv

## Prioritási sorrend

1. **Vertikális szelet:** autentikáció és backend RBAC → termékkatalógus → termékoldal → kosár → checkout → tranzakciós készletfoglalás → rendelés → admin/raktári rendeléskezelés.
2. **Jármű-kompatibilitás:** márka → modell → generáció → motor, garázs, fitment-szűrés, OEM/alternatív cikkszámok és külső katalógus-adapter.
3. **Kereskedelmi funkciók:** promóciók, kuponok, vásárlói árcsoportok, termékkapcsolatok, CSV import/export és tömeges admin műveletek.
4. **Raktár és fulfillment:** több raktár, készletmozgási főkönyv, bevételezés, foglalás/feloldás, komissiózás, csomagolás, átadás, visszáru és raktárközi átadás.
5. **Integrációk és üzemeltetés:** MinIO, Redis, Mailpit, mock fizetés/futár/katalógus, aláírt-idempotens webhookok, audit és riportok.
6. **Minőségkapu:** lint, typecheck, unit/integrációs/E2E tesztek, Docker build és healthcheck.

## Adatmodell magja

- **Felhasználó és jogosultság:** `User`, `Role`, `Address`, `CustomerGroup`, `AuthToken`, `AuditLog`.
- **Jármű:** `VehicleBrand` → `VehicleModel` → `VehicleGeneration` → `VehicleEngine`, valamint `GarageVehicle`.
- **Katalógus:** `Manufacturer`, hierarchikus `Category`, `Product`, `ProductVariant`, `ProductImage`, `ProductDocument`, `ProductFitment`, `ProductRelation`.
- **Árazás:** `Promotion`, `PromotionProduct`, `Coupon`, `CouponUsage`; a rendelési sorok saját ár-/ÁFA-/kedvezmény-pillanatképet tárolnak.
- **Kosár és rendelés:** `Cart`, `CartItem`, `Order`, `OrderItem`, `OrderStatusHistory`, `ReturnRequest`, `Review`.
- **Raktár:** `Warehouse`, `InventoryBalance`, változtathatatlan `InventoryMovement`; az elérhető készlet a fizikai és foglalt állapotból vezethető le.
- **Integrációs állapot:** `PaymentEvent` az idempotens fizetési webhook-feldolgozáshoz, `SystemSetting` a konfigurálható rendszerértékekhez.

## Fontos invariánsok

- Jogosultságot minden védett műveletnél a backend ellenőriz.
- Checkout és készletfoglalás adatbázis-tranzakcióban történik; negatív vagy túlfoglalt készlet nem megengedett.
- Rendelésállapot csak a definiált állapotgépen keresztül változhat, és minden váltás előzménybe kerül.
- Készletváltozás minden esetben főkönyvi mozgást hoz létre.
- Külső fizetés, futár és katalógus adapter mögött van; lokálisan mock implementáció használható.
- Publikálás előtt a jogi mintaszövegek külön szakmai/jogi felülvizsgálatot igényelnek.
