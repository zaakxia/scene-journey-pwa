# 圣地巡礼 Scene Journey — Project Reference

PWA + Desktop dual-interface anime pilgrimage map app. Pure HTML/CSS/JS + Leaflet.js, zero build, zero framework.

## Architecture

```
scene-journey-pwa/
├── ip/index.html          # PWA entry (mobile-first)
├── desktop/index.html     # Desktop entry (all inline JS, no separate files)
├── js/                    # PWA scripts (shared by PWA and desktop)
│   ├── app.js             # Main app logic, transit engine, plan page, profile, search
│   ├── map.js             # Leaflet map wrapper (shared canvas, markers, labels)
│   ├── data-loader.js     # IP data loading
│   ├── storage.js         # localStorage wrapper
│   └── ui/                # UI components
│       └── location-card.js
├── js/utils/geo.js        # GeoUtils: WGS-84 ↔ GCJ-02 conversion
├── js/vendor/             # Third-party libs
├── css/                   # Shared styles
├── data/ip/               # Pilgrimage site data (JSON/JS)
├── assets/
│   ├── tiles/             # 241,815 CartoDB Light tiles (gitignored)
│   ├── icons/             # PWA icons
│   └── images/            # Site photos
├── pages/                 # Extra pages (admin.html, etc.)
├── scripts/               # Utility scripts (tile download, batch push)
├── sw.js                  # Service Worker
└── manifest.json          # PWA manifest
```

**Dual interface rule:** PWA logic lives in `js/*.js`. Desktop has ALL its JavaScript inline in `desktop/index.html` — it reads shared `js/` files only for map.js and Leaflet. Changes to PWA `js/app.js` do NOT automatically affect desktop; desktop must be updated separately.

## Coordinate Systems (CRITICAL)

| Layer | System | Reason |
|-------|--------|--------|
| **Storage** (`data/ip/`) | WGS-84 | International standard, matches OSM/CartoDB tiles |
| **Display** (Leaflet markers) | WGS-84 | Direct tile alignment |
| **Amap API calls** | GCJ-02 | Amap requires Chinese coordinate system |
| **HERE API calls** | WGS-84 | HERE uses international standard |

**Runtime conversion:** `GeoUtils.toGcj02(lat, lng)` in `js/utils/geo.js` converts WGS-84 → GCJ-02 before every Amap API call. Never store GCJ-02 coordinates.

**`isChina(lat, lng)`** in app.js: lng cap is **128** (not 135), to exclude Japan (松山 lng 132.7).

## API Keys & Routing Engines

| Engine | API Key | Scope | Rate Limit |
|--------|---------|-------|------------|
| Amap (高德) | `5863650c584b70f0acfcc28ce028f90d` | China only | 5K/day |
| HERE Maps | `dMiGuj4zcqtcdaecBgclwcZ44IYRALPP9X_q9A28Ajg` | Global | 250K/month |

**Keys are hardcoded** in both `js/app.js` and `desktop/index.html`. No `.env` file.

**API routing logic:**
- **Search**: Nominatim (global, no proxy needed) → Amap fallback for Chinese text
- **Transit**: HERE for global, Amap for China only (requires no proxy)
- **Transit public transport**: `transit.hereapi.com/v8/routes` (separate domain from driving)
- OSRM is the universal fallback (free, no key, approximate)
- HERE transit returns `noCoverage` notice in rural areas → labeled "HERE公交(无数据)"

**HERE daily limit threshold:** 8,000 calls/day (250K ÷ 30). Track via `localStorage['sj_here_count']`.

### Search Pipeline (three-tier)
1. **CF Worker** (`/api/search?q=`) — proxies Nominatim via CF edge (bypasses GFW). Free tier: 100K req/day.
2. **Local landmark DB** (`data/landmarks.json`) — ~55 global landmarks, fuzzy matched client-side. Zero API cost.
3. **Amap inputtips** — China-only fallback. 5K req/day free.

### API Rate Limit Summary
| Service | Limit | Threshold | Tracking |
|---------|-------|-----------|----------|
| Cloudflare Worker | 100K req/day | 30K req/day | CF Dashboard |
| Nominatim (via Worker) | 1 req/s | enforced by Worker | Worker code |
| HERE Maps | 250K req/month | 8,000 req/day | `localStorage['sj_here_count']` |
| Amap Web Service | 5K req/day | 3,000 req/day | — |
| OSRM | Unlimited | — | Public service, no key |

## Key Conventions

### Event Binding
**ALWAYS use `.onclick = fn` assignment**, NEVER `addEventListener('click', fn)`. The plan page and other components re-render DOM, and `addEventListener` accumulates duplicate handlers. `.onclick` naturally replaces.

### PWA vs Desktop
- PWA: touch targets ≥44px, no `:hover`, `100dvh`, mobile-first (375-414px)
- Desktop: hover OK, sidebar nav at 72px, overlay panels at PWA-width (430px)
- PWA HTML at `ip/index.html`; desktop HTML at `desktop/index.html`
- Shared: `assets/`, `data/ip/`, `js/vendor/`, `css/`

### Custom Locations
User-added pilgrimage sites stored in `localStorage['sj_custom_locations']` as JSON array. Merged into map markers and plan page alongside built-in data. Detail card shows delete button for custom locations. Search result click shows temporary blue pulsing marker before committing.

### Duration Overrides
All locations (built-in + custom) have editable visit duration in detail cards. Overrides stored in `localStorage['sj_duration_overrides']` as `{locId: 'Xh'}`. Plan page applies overrides on render.

### Plan Page
- Day tabs: PWA-style pills with `label|×` delete, add-day from smallest gap
- Transit toggle: 高德/HERE buttons for China/global routing
- Transit query modal: select from/to locations, query driving/transit/walking time
- **Auto transit gap**: placing block after previous auto-reserves transit time gap
- **Transit arrows**: `↓ 15min ↓` between consecutive blocks in timeline
- **Transit summary**: below timeline shows engine, original minutes, rounded half-hour
- **Clear button**: red 清空 clears all blocks for current day
- **Step-by-step transit**: HERE公交 shows walk→ride→walk breakdown
- Manual + Auto (智能推荐) modes with engine selection

## Development Workflow

```
1. localhost:8080 test (Python http.server or similar)
2. Incognito browser verification
3. git add + commit (English message)
4. git -c http.proxy=http://127.0.0.1:7897 push  (suyou must be ON)
5. Cloudflare Pages auto-deploys from master
```

**Local test URLs:**
- PWA: `http://localhost:8080/ip/?book=dragon-raja`
- Desktop: `http://localhost:8080/desktop/`
- Admin: `http://localhost:8080/pages/admin.html`

**Serve command:** `cd scene-journey-pwa && python -m http.server 8080`

## Deploy

| Target | URL | Host |
|--------|-----|------|
| PWA | `scene-journey-pwa.pages.dev` | Cloudflare Pages |
| Desktop | `scene-journey-desktop.pages.dev` | Cloudflare Pages |
| Tiles | `zaakxia.github.io/scene-journey-pwa/assets/tiles/` | GitHub Pages |

**Cloudflare build command:** copies `assets/icons` and `assets/images` only (NOT tiles — they're on GitHub Pages). Build output dir: `out/`.

**GitHub:** `github.com/zaakxia/scene-journey-pwa` (migrated from suspended Zaak985 on 2026-05-12).

## Known Pitfalls

1. **Never commit tiles.** 241K files (1.4GB) will trigger GitHub abuse detection. `.gitignore` excludes `assets/tiles/`.
2. **Batch push tiles only.** Use `scripts/batch_push_tiles.py` — 5000 tiles per commit max.
3. **Amap API needs China IP.** Do NOT proxy Amap calls through v2rayN — Amap blocks non-China IPs.
4. **Cloudflare 20K file limit.** Build must NOT copy tiles directory.
5. **Brace balance in desktop/index.html.** All JS is inline (~3000+ lines). Verify with `grep -c "{"` vs `grep -c "}"` before committing.
6. **`sed` escaping.** Cloudflare build uses `sed` — dots in regex must be escaped (`\.\.` not `..`).
7. **Service Worker caches shell only.** SW excludes API calls (hereapi.com, amap.com, nominatim, komoot) to avoid `response.clone()` errors.
8. **HERE transit no-coverage.** Rural areas (Japan Shikoku, etc.) return `noCoverage` — system falls back to driving×1.6 estimate, labeled "HERE公交(无数据)".
9. **parseDuration** now handles three formats: Chinese (`2小时`), short (`2h`), and days (`1天`).
