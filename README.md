# Comanda Bunătăți / Bunătăți Market

Aplicație React + Vite publicată pe Cloudflare Pages.

## Module

- `/` — Bunătăți Market, marketplace intern pentru colegi.
- `/comanda` — fluxul existent pentru comanda comună/lunară.
- `/admin` — administrarea fluxului vechi.

## Firebase

Proiectul folosește Firebase Authentication, Firestore și Storage.

Fișierele canonice pentru reguli sunt:

- `firestore.rules`
- `storage.rules`
- `firebase.json`

Înainte de publicarea marketplace-ului pe `main`, regulile trebuie publicate în proiectul Firebase `comanda-bunatati`:

```bash
npx firebase-tools deploy --only firestore:rules,storage --project comanda-bunatati
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
