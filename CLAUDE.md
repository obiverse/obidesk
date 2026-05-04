# obiDesk

**Digital systems for real-world businesses. From signboard to system.**

Abuja business directory PWA. No framework, no bundler, no npm.

## Build

```bash
./build.sh          # Build desk-search WASM crate
./build.sh docs     # Build + copy to docs/pkg/ + stamp SW
./build.sh serve    # Start dev server on :8080
./build.sh test     # Run Rust tests
```

## Dev Server

```bash
cd docs && python3 -m http.server 8080
```

## Architecture

- `docs/` — Static site deployed to GitHub Pages
- `crates/desk-search/` — Rust/WASM fuzzy search
- HTML pages with query-param routing (`desk.html?b=slug`)
- Static JSON data (`docs/data/`)
- Service worker with 5 caching strategies
- IndexedDB for offline field captures

## Pages

| Page | Purpose |
|------|---------|
| index.html | Landing: hero, search, categories, areas, pricing |
| browse.html | Directory: filter by category, area, text search |
| desk.html?b={slug} | Business profile with WhatsApp/Call/Map CTAs |
| get-listed.html | Business self-submission form |
| request-system.html | Custom system request form |
| field.html | Operator field capture (offline-capable) |
| offline.html | Offline fallback |

## Data

- `docs/data/categories.json` — 15 Abuja categories
- `docs/data/areas.json` — 19 Abuja areas
- `docs/data/businesses.json` — Business listings

## Adding a Business

Edit `docs/data/businesses.json`. Each business needs:
- Unique `id` (increment) and `slug` (URL-safe)
- `categoryIds` array matching category IDs
- `areaId` matching an area ID
- `whatsapp` number (digits only, with country code 234)

## Operator WhatsApp

Update `OBIDESK_WHATSAPP` in `docs/js/whatsapp.js` with the real operator number.
