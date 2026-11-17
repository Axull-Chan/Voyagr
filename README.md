# Voyagr

An AI travel planner — turn a destination and a few preferences into a full
day-by-day itinerary with a map, weather, a budget tracker and a packing list,
then adjust it by chatting.

Built as a 13-phase portfolio project. What is done and what isn't is tracked
in [CLAUDE.md](./CLAUDE.md) under "Phase status", along with the engineering
notes and the reasoning behind non-obvious decisions.

## Tech stack

- **App**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4,
  shadcn/ui on Base UI primitives, Framer Motion. Design system: see
  [DESIGN.md](./DESIGN.md).
- **Backend**: Supabase — Postgres, Auth, Row Level Security.
- **Itinerary generation**: a provider abstraction (`src/lib/ai`). Gemini is the
  live provider; OpenAI is fully wired but unused; a deterministic mock is the
  default when no provider is configured.
- **Real-world data**: Open-Meteo (weather), Frankfurter (currency),
  OpenTripMap (places), Unsplash (photos). Maps are MapLibre GL with OpenFreeMap
  tiles and Nominatim geocoding.
- **Quality**: ESLint, `tsc`, Vitest, GitHub Actions.
- **Hosting**: Vercel.

## Getting started

Requires Node 22 (see `.nvmrc`).

```bash
npm install
cp .env.example .env.local   # then fill in the Supabase values
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

Only the two Supabase variables are needed to run the app. Everything else is
optional, and each feature degrades to a clearly labelled fallback when its key
is missing. `.env.example` documents every variable.

| Variable                                | Without it                                    |
| --------------------------------------- | --------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`              | **Required.**                                 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`  | **Required.**                                 |
| `AI_PROVIDER` + `GEMINI_API_KEY`        | Itineraries come from the mock planner        |
| `OPENTRIPMAP_API_KEY`                   | No real places; example venues are labelled   |
| `UNSPLASH_ACCESS_KEY`                   | No destination photo                          |
| `AI_LIMIT_TRIPS_*`, `AI_LIMIT_CHAT_*`   | Default daily limits apply (see below)        |

Weather, currency, maps and geocoding need no key.

### Usage limits

The two calls that spend model quota are limited over a rolling 24 hours: 5 trip
generations and 30 chat messages per traveller, and 250 and 500 across everyone
(sized for the free Gemini tier). A traveller over a limit gets a plain message
saying when they can try again. The four `AI_LIMIT_*` variables in `.env.example`
change them without a code change. They don't apply to the mock provider, and a
call that fails doesn't use up an allowance.

## Scripts

| Script                 | Purpose                                      |
| ---------------------- | -------------------------------------------- |
| `npm run dev`          | Dev server (Turbopack)                       |
| `npm run build`        | Production build                             |
| `npm run lint`         | ESLint                                       |
| `npm run type-check`   | `tsc --noEmit`                               |
| `npm test`             | Unit tests (Vitest)                          |
| `npm run test:watch`   | Unit tests in watch mode                     |
| `npm run format`       | Prettier (writes)                            |
| `npm run format:check` | Prettier (check only)                        |

`dev` and `build` first run `scripts/copy-maplibre-worker.mjs`, which copies
MapLibre's tile worker into `public/maplibre/` (git-ignored, regenerated every
time). The map's basemap stays blank without it; see CLAUDE.md for why.

## Testing and CI

`npm test` covers the app's pure logic — date and money maths, validation
schemas, the trip export, and the rule that the AI layer may choose among real
venues but never invent one. It needs no network, database or environment
variables. GitHub Actions runs lint, type-check, tests and a production build on
every push to `main` and every pull request.

Server actions and anything that needs Supabase are not covered by automated
tests yet.

## Project structure

```
src/
  app/            # routes — route groups: (marketing), (auth), (app)
  components/     # ui/ (shadcn primitives), layout/, shared/
  features/       # feature modules (auth/, trips/, film/, marketing/ …)
  integrations/   # one folder per external API (gemini, openmeteo, …)
  services/       # combine integrations into what the app needs
  lib/            # supabase clients, AI providers, trip domain, motion
  types/          # generated Supabase types
supabase/migrations/   # SQL migrations — mirror what is applied to the project
scripts/               # build-time helpers
```

Database migrations are applied to the Supabase project by hand (or through the
Supabase MCP); the files in `supabase/migrations/` are the record of what was
applied, not something a deploy runs automatically.
