# MultiStocks AI backend — PHP port

Plain-PHP port of the Python/FastAPI backend in `../backend`, built to run
on ordinary shared/cPanel-style hosting that doesn't support Python: no
framework, no Composer dependency required, just PHP files behind a small
front controller (`index.php`). Requires PHP 7.4+ with the `curl` and
`simplexml` extensions (both are enabled by default on almost every shared
host).

It serves the same mobile-app-facing REST endpoints as `backend/main.py`
(see that file for the authoritative route list), plus the `/api/admin/*`
routes used by the separate web admin dashboard. One behavioral note: the
admin "System Logs" page reads `GET /api/admin/logs`, which here persists
to `data/system_events.json` instead of an in-process list (see
`system_events_get()`/`system_event_add()` in `lib/helpers.php`), since
PHP has no long-running process to hold Python's in-memory list between
requests.

## Deploying on shared/cPanel hosting

**Option A — point the (sub)domain's document root at this folder.**
In cPanel: Domains → your domain/subdomain → set the document root to the
`backend-php/` folder (upload its contents, or the whole repo and set the
document root path to `.../backend-php`). Then:

- `GET https://your-domain.example/api/stocks` works directly if your host
  runs everything through `index.php` for unknown paths (check "Option A"
  works by hitting `/health` first) — otherwise use Option B.

**Option B — can't change the document root, or clean URLs 404.**
Most shared hosts default the document root to `public_html/` and won't
let you point it elsewhere, or the host's Apache doesn't rewrite by
default. Use the included `.htaccess` (already in this folder) — it
rewrites any request for a path that isn't a real file/directory to
`index.php`, which then routes based on the request path. Just make sure:

1. `mod_rewrite` is enabled (it is on virtually all cPanel hosts).
2. This folder's contents (including the `.htaccess`) are uploaded as the
   web root the domain/subdomain points to.
3. If the app is deployed under a subfolder instead of the domain root
   (e.g. `https://example.com/backend/`), uncomment and set `RewriteBase`
   in `.htaccess` to match.

Either way, once deployed, `GET /health` should return
`{"status":"ok","service":"backend"}`, and the mobile app's API base URL
(in its own settings/config) should point at this domain.

## Directory layout

```
backend-php/
  index.php          front controller — all routing happens here
  lib/                ported PHP modules (one per Python source file)
    helpers.php        JSON/CORS helpers, tiny file cache, curl wrappers
    stock_profiles.php  STOCK_PROFILES seed data (ported from data_fetcher.py)
    data_fetcher.php    simulation engine + news fetching
    technical_analysis.php  RSI/MACD/Bollinger Bands math
    macro_fetcher.php   forex/commodities/index widget data
    ai_advisor.php       rule-based recommendations/chat + Gemini/OpenAI calls
    markets.php          markets.json loader + global stock search indices
  data/markets.json   copy of backend/markets.json
  prompts.json        copy of backend/prompts.json (LLM prompt overrides)
  cache/              file-based cache (auto-created; not real data, just
                       a TTL cache — safe to delete anytime)
  .htaccess           Apache rewrite rule for Option B above
  .env.example        documents the env vars this app reads
```

## Environment variables (API keys)

Copy `.env.example` to `.env` and fill in values, **or** — the more robust
option on shared hosting, since some hosts serve a stray `.env` file as
plain text if `.htaccess` isn't honored — set these directly as real
environment variables:

- **cPanel** → "Setup Node.js App" is unrelated; instead use "MultiPHP
  INI Editor" or your host's "Environment Variables" panel if it has one,
  or ask support to set them at the PHP-FPM pool level.
- **Any host, via `.htaccess`** (if `mod_env` is enabled):
  `SetEnv GEMINI_API_KEY "your-key-here"` — PHP reads these with
  `getenv()` the same as a real env var.
- **Programmatically**, e.g. from a bootstrap file your host auto-includes:
  `putenv('GEMINI_API_KEY=your-key-here');`
- **Fallback used automatically by this app**: if a `.env` file exists in
  this directory, `index.php` parses simple `KEY=VALUE` lines from it on
  every request (see the top of `index.php`) — no extra library needed.
  Keep `.env` out of version control; `.htaccess` also blocks direct HTTP
  access to any `.env*` file as a second layer of protection.

Variables:

| Variable | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | No | Enables real LLM-generated recommendations/chat/portfolio analysis via Gemini. Falls back to the deterministic rule-based engine when unset. |
| `OPENAI_API_KEY` | No | Same, via OpenAI, used if Gemini isn't configured or its call fails. |
| `USE_TEST_ADS` | No | Exposed via `GET /api/settings` for the mobile app (defaults to `true`). |
| `MOBILE_API_URL` | No | Exposed via `GET /api/settings`. |

Neither key is required — with neither set, every AI-powered endpoint
falls back to the same deterministic rule-based engine the Python backend
uses, so the app is fully functional without any LLM subscription.

## Known divergences from the Python backend

- **No in-process cache.** The Python backend keeps quote/news/analysis
  caches as in-memory dicts inside one long-running `uvicorn` process.
  Plain PHP on shared hosting has no long-running process — each request
  is a fresh PHP-FPM/mod_php invocation — so this port replaces those
  caches with small JSON files under `cache/` (same TTLs: 2 min quotes,
  2 min market news, 5 min ticker news, 1 hr forex, 15 min commodities,
  5 min index). Functionally equivalent; just backed by disk instead of
  RAM. Safe to delete `cache/` at any time — it will be recreated.
- **Random-walk determinism.** The simulation engine (`lib/data_fetcher.php`)
  ports the same ticker-seeded random-walk algorithm shape (drift/volatility
  by ticker, geometric-Brownian-motion-style steps) using PHP's
  `mt_srand()`/`mt_rand()` instead of Python's `random`/`numpy` RNGs. Same
  determinism property (same ticker → same historical series within one
  request), but the exact numeric values will differ from the Python
  version — this was called out as acceptable in the porting brief.
- **`GET /api/macro` / commodity & index quotes.** The Python backend used
  the `yfinance` Python package; this port calls Yahoo Finance's public
  chart JSON endpoint directly via curl
  (`https://query1.finance.yahoo.com/v8/finance/chart/{symbol}`). Response
  shape returned to the mobile app is unchanged. The KSE-100 index level
  is still never fetched live in either version (PSX market-data licensing
  — see the note in `backend/data_fetcher.py`), so it stays simulated here
  too.
- **`POST /api/settings`.** The Python version rewrites `backend/.env` and
  hot-swaps in-process SDK clients. This port writes `backend-php/.env`
  the same way, but there's no persistent process to hot-swap — new keys
  take effect on the *next* request once loaded (from `.env`, or from a
  host-level env var you set separately). If the web root isn't writable
  on your host (common on stricter shared hosting), this endpoint returns
  a 500 explaining to use your host's environment-variable panel instead.
- **LLM calls.** Ported to plain `curl` REST calls against Gemini's
  `generateContent` endpoint and OpenAI's `chat/completions` endpoint,
  instead of the `google-generativeai`/`openai` Python SDKs. Same models
  (`gemini-1.5-flash`, `gpt-4o-mini`), same prompts (including
  `prompts.json` overrides), same JSON-fence-stripping parse logic.

## Admin routes

`/api/admin/*` (used by the separate web admin dashboard, not the mobile
app) has no authentication in either the Python or this PHP version — it's
assumed to sit behind network-level access control (VPN, IP allowlist, a
non-public subdomain) if exposed publicly. Same behavior ported here.

- `GET/POST /api/admin/prompt` — reads/writes `prompts.json`.
- `POST /api/admin/fetcher/trigger?market=` — warms the quote cache for a market's watchlist.
- `GET /api/admin/logs` — see the system-events note above.
- `GET/POST /api/admin/markets` — reads/writes `data/markets.json`.

## Syntax-checking

Every file here should pass `php -l`:

```sh
for f in index.php lib/*.php; do php -l "$f"; done
```
