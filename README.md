# Annotate

Highlight and annotate web articles, then share an annotated reading view with friends — like Word's comment system, but for any article on the internet.

## Getting Started

Install dependencies:

```bash
npm install
```

Copy the environment file and fill in your Supabase credentials:

```bash
cp .env.example .env.local
```

Push the database schema:

```bash
npm run db:push
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Build for production |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run db:push` | Push Drizzle schema to the database |
| `npm run db:studio` | Open Drizzle Studio (database browser) |

## Stack

- **Next.js 16** (App Router) — framework
- **TypeScript** — language
- **tRPC v11** + **TanStack Query** — type-safe API layer
- **Drizzle ORM** + **PostgreSQL** — database
- **Supabase** — hosted Postgres + auth
- **Tailwind CSS** — styling
- **@mozilla/readability** + **jsdom** — article parsing
