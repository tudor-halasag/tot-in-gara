# TotÎnGară.ro

> Speranța moare în gară.

Platformă civică pentru raportarea întârzierilor trenurilor din România.

## Structura proiectului

```
tot-in-gara/
├── index.html        # Pagina principală
├── style.css         # Stiluri
├── app.js            # Logică aplicație (Phase 1: localStorage)
├── assets/
│   ├── tahlogo.svg   # Logo TAH (furnizat separat)
│   └── trainphoto1.svg # Ilustrație tren (furnizat separat)
└── README.md
```

## Faze de dezvoltare

### ✅ Phase 1 — Static / localStorage
- UI complet funcțional
- Rapoarte stocate în `localStorage` al browserului
- Funcționează local, fără backend

### 🔜 Phase 2 — Firebase (urmează)
- Rapoarte sincronizate în timp real între utilizatori
- Highscores permanente
- Date agregate live

## Rulare locală

Deschide `index.html` direct în browser.  
Sau folosește un server local:

```bash
npx serve .
# sau
python3 -m http.server 8080
```

## Deploy pe GitHub Pages

1. Creează repo: `tudor-halasag/tot-in-gara`
2. Push toate fișierele
3. Settings → Pages → Source: `main` / `root`
4. URL: `https://tudor-halasag.github.io/tot-in-gara`

## Domain custom (viitor)

Adaugă fișier `CNAME` cu conținutul:
```
totingara.ro
```

Și configurează DNS-ul domeniului cu:
- `A` record → `185.199.108.153`
- `A` record → `185.199.109.153`
- `A` record → `185.199.110.153`
- `A` record → `185.199.111.153`
- `CNAME` `www` → `tudor-halasag.github.io`

## Assets necesare

Plasează în `/assets/`:
- `tahlogo.svg` — logo personal TAH
- `trainphoto1.svg` — ilustrație tren amuzant (la alegere)
