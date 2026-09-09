# Bunătăți împreună

Mini-magazin intern pentru comenzile comune de nuci, fructe uscate și dulciuri.

**Versiune statică pentru Cloudflare Pages** (fără Workers).

## Funcționalități

- catalog cu filtrare și căutare
- coș cu calcul automat în lei
- comenzi salvate în Cloud Firestore
- panou de manager (`/admin`) protejat prin Firebase Authentication
- totaluri pe persoană și pe produs
- evidența plăților și export CSV

## Dezvoltare

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Output: folderul `dist/`.

## Cloudflare Pages (GitHub)

În Dashboard → Settings → Builds & deployments:

| Setare | Valoare |
|--------|---------|
| Framework preset | None / Vite |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | (gol) |
| Node.js version | `22` |

Sau din terminal:

```bash
npm run deploy
```

Site: `https://comanda-bunatati.pages.dev`  
Admin: `https://comanda-bunatati.pages.dev/admin`
