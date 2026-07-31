# Voyagr

An AI travel planner SaaS — turn a destination and a few preferences into a
full day-by-day itinerary, with budget, weather, and maps built in.

Built as a 13-phase portfolio project. **Phase 1 (project foundation) is
complete**; see [CLAUDE.md](./CLAUDE.md) for the full phase roadmap and
engineering notes.

## Tech stack

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS v4,
  shadcn/ui (Base UI primitives), Framer Motion
- **Backend**: Supabase (Postgres + Auth, Row Level Security)
- **Forms**: React Hook Form + Zod
- **Planned**: OpenAI, Google Maps, OpenWeather, ExchangeRate APIs (later
  phases)
- **Deployment**: Vercel

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in Supabase URL + publishable key
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

See [.env.example](./.env.example) for the full list and which phase each
variable is needed for. Only the Supabase variables are required to run the
app today.

### Scripts

| Script                | Purpose                          |
| ---------------------- | --------------------------------- |
| `npm run dev`          | Start the dev server (Turbopack)  |
| `npm run build`        | Production build                  |
| `npm run lint`         | ESLint                            |
| `npm run type-check`   | `tsc --noEmit`                    |
| `npm run format`       | Prettier (writes)                 |
| `npm run format:check` | Prettier (check only)             |

## Project structure

```
src/
  app/            # routes (route groups: (marketing), (auth), (app))
  components/     # ui/ (shadcn primitives), layout/, shared/
  features/       # feature-based modules (auth/, trips/, ...)
  lib/            # supabase clients, utils, motion variants
  types/          # generated Supabase types
supabase/migrations/  # SQL migrations (mirrors what's applied to the project)
```
