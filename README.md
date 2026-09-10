# GymApp

Free gym and nutrition app: track your food and your training in one place.
One Expo codebase for iOS and web.

## Getting started

```bash
npm install
cp .env.example .env   # fill in your Supabase URL + publishable key
npm start              # scan the QR code with Expo Go
npm run web            # or run it in the browser
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Expo dev server |
| `npm run web` | Web version at http://localhost:8081 |
| `npm test` | Jest tests |
| `npm run typecheck` | TypeScript check without emitting |

## Tech

Expo SDK 57 · Expo Router · TypeScript · Supabase (Auth + Postgres with RLS) ·
TanStack Query · jest-expo.

See `CLAUDE.md` for the architecture, data model and roadmap.
