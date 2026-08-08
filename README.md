# Fleger Warehouse

Modern, multi-tenant Inventory Management SaaS alap Angular frontenddel, NestJS backenddel és MongoDB adatbázissal.

A cél nem egyetlen cég belső raktárprogramja, hanem olyan B2B SaaS foundation, ahol több ügyfélcég ugyanazt a rendszert használhatja úgy, hogy az üzleti adatok tenant szerint szigorúan el vannak választva.

## Tech stack

- Frontend: Angular 22, standalone components, signals, reactive forms, Angular Router, SCSS
- Backend: NestJS 11, TypeScript, MongoDB, Mongoose, REST API, JWT, RBAC, Swagger
- Infrastructure: Docker Compose, környezetfüggő konfiguráció, külön frontend és backend app

## Projektstruktúra

```text
apps/
  api/     NestJS backend
  web/     Angular frontend
docs/      architektúra és tervezési dokumentáció
```

Fontos dokumentumok:

- [Architecture Overview](docs/architecture-overview.md)
- [API Design](docs/api-design.md)
- [Implementation Roadmap](docs/implementation-roadmap.md)

## Gyors indítás

Előfeltételek:

- Node.js 22+
- npm 10+
- Docker Desktop

Telepítés:

```bash
npm install
```

Lokális infrastruktúra indítása:

```bash
docker compose up -d mongo
```

MongoDB collectionök és indexek létrehozása:

```bash
npm run api:mongo:init
```

Backend fejlesztői módban:

```bash
npm run api:dev
```

Frontend fejlesztői módban:

```bash
npm run web:dev
```

Belépés a webes felületen:

```text
http://localhost:4200/login
```

Ha nincs érvényes frontend auth state, az alkalmazás automatikusan a `/login` oldalra irányít. Sikeres belépés után a korábban megnyitott védett route-ra tér vissza, vagy alapértelmezetten a dashboardra navigál.

Seedelt demo belépési adatok:

```text
admin@acme.test / Password123!
admin@demo.test / Password123!
platform@fleger.test / Password123!
```

A saját Fleger admin user super adminként is seedelődik, így a Platform Admin képernyőn az összes tenantot látja.
Meglévő adatbázison reset nélkül is bekapcsolható:

```bash
npm run api:promote:super-admin
```

Alap URL-ek:

- Frontend: `http://localhost:4200`
- API: `http://localhost:3000/api/v1`
- Swagger: `http://localhost:3000/docs`
- MongoDB: `mongodb://localhost:27017/fleger_warehouse`

Teljes stack Dockerrel:

```bash
docker compose up --build
```

## Környezeti változók

Backend példa:

```bash
cp apps/api/.env.example apps/api/.env
```

Fontosabb értékek:

- `MONGODB_URI`: MongoDB kapcsolat
- `JWT_ACCESS_SECRET`: access token aláíró kulcs
- `JWT_REFRESH_SECRET`: refresh token aláíró kulcs
- `API_PORT`: backend port
- `CORS_ORIGIN`: frontend origin

## Fejlesztői seed

A backend seed parancsa fejlesztői demó adatokat készít elő:

```bash
npm run api:seed
```

A seed előtt érdemes lefuttatni:

```bash
npm run api:mongo:init
```

Seedelt minta:

- Platform admin
- ACME Kft. tenant saját adminnal, warehouse managerrel, dolgozókkal, járművekkel és inventory adatokkal
- Demo Logistics Kft. elkülönített tenant külön felhasználóval és üzleti adatokkal

## Tenant isolation alapelv

Normál API kérésnél a backend soha nem bízik a frontend által küldött `tenantId` értékben. Az aktív tenant:

1. az autentikált userből,
2. a tenant membershipből,
3. és az aktuális workspace választásból

áll elő.

A tenant-szűrés központi repository/service rétegben történik. Tenant-scope alá tartozó üzleti entitásnál minden lekérdezés és módosítás `tenantId` feltétellel fut. Így egy manipulált URL vagy API payload sem tudja megkerülni a tenant boundary-t.

## Tesztek

Backend:

```bash
npm run api:test
```

Frontend:

```bash
npm run web:test
```

Prioritást élvező backend tesztek:

- Tenant A user nem olvashat Tenant B adatot
- Tenant A user nem módosíthat Tenant B adatot
- Tenant admin nem fér hozzá más tenant resource-hoz
- Inventory assignment nem mehet available quantity fölé
- Asset egyszerre csak egy aktív assignmenttel rendelkezhet
- Vehicle egyszerre csak egy aktív dolgozóhoz lehet kiadva

## API használat

Az API versionözött:

```text
/api/v1/auth
/api/v1/tenants
/api/v1/dashboard
/api/v1/inventory
/api/v1/employees
/api/v1/vehicles
/api/v1/assignments
/api/v1/audit-log
/api/v1/platform-admin
```

Tenant-kötött kéréseknél a frontend az aktív workspace-t headerben jelzi:

```http
X-Tenant-Slug: acme
Authorization: Bearer <access-token>
```

A backend ezt membership ellenőrzéssel validálja, és ebből állítja elő a request tenant contextet.

## SaaS readiness

Az MVP nem tartalmaz Stripe-ot, email szolgáltatót, mobil appot, barcode scan funkciót vagy realtime websocketet. Az architektúra viszont előkészíti:

- tenantonkénti feature flag rendszer
- plan és limit ellenőrzés backend oldalon
- platform admin tenant management
- audit log
- domain event alapú bővíthetőség
- későbbi API key és külső integrációk
