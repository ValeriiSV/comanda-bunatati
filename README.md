# Comanda Bunătăți / Bunătăți Market

Aplicație React + Vite publicată pe Cloudflare Pages.

## Module

- `/` — Bunătăți Market, marketplace intern pentru colegi.
- `/comanda` — fluxul existent pentru comanda comună/lunară.
- `/admin` — administrarea fluxului vechi.

## Firebase

Proiectul folosește Firebase Authentication și Firestore și rămâne compatibil cu planul gratuit Spark.

Marketplace-ul NU folosește Firebase Storage. Fotografiile anunțurilor sunt redimensionate și comprimate în browser, apoi sunt salvate ca Data URL JPEG direct în documentul `marketListings` din Firestore. Aplicația limitează imaginea rezultată la aproximativ 380 KB, iar regulile Firestore permit maximum 400.000 de caractere pentru câmpul `imageUrl`.

Fișierele canonice pentru reguli sunt:

- `firestore.rules`
- `firebase.json`

Pentru publicarea regulilor în proiectul Firebase `comanda-bunatati`:

```bash
npx firebase-tools deploy --only firestore:rules --project comanda-bunatati
```

Regulile păstrează compatibilitatea cu vechiul catalog și cu `groupOrders`, dar adaugă colecțiile marketplace:

- `marketUsers`
- `marketListings`
- `marketOrders`

Conturile noi sunt create cu `approved: false`; administratorul principal le aprobă din panoul marketplace. Contul administratorului este determinat de emailul configurat în aplicație și în regulile Firestore.

## Dezvoltare

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

Deploy Cloudflare Pages:

```bash
npm run deploy
```
