# Annotate — Shared Article Highlights & Commentary

## Vision

A web app that lets you highlight and comment on web articles, then share an annotated reading view with friends — like Word's comment system, but for any article on the internet. You never reproduce someone else's content as your own; you create a *reading layer* on top of it.

---

## The Problem

You read a long article, find five interesting parts, and want to share your reactions with friends. Today that means sending a link plus a wall of text like "in paragraph 3 they mention X which is interesting because…". Your friends have to bounce between your message and the article, trying to map your comments to the right passages. It's clunky.

**Annotate** solves this by letting your friends see your highlights and comments *in context*, directly alongside the article text.

---

## Core User Experience

### You (the annotator)

1. Paste an article URL into Annotate.
2. The app extracts the article into a clean reading view.
3. You select passages of text and attach comments to them — just like commenting in Google Docs or Word.
4. You get a shareable link.

### Your friends (the readers)

1. They open your link.
2. They see the article in a clean reading view with your highlighted passages and margin comments.
3. A banner at the top credits the original source with a direct link.
4. They read the article with your commentary as a guide.

---

## Content & Copyright Approach

The app is designed to respect original content creators. The guiding principles:

- **Reader mode, not reproduction.** The app extracts article text the same way Firefox Reader View or Safari Reader does — stripping ads, navigation, and layout to present just the content. This is a *transformative* presentation where your annotations are the primary value.
- **Always attribute and link.** Every annotated view prominently displays the original source URL, article title, and author name with a direct link. The goal is to drive traffic *to* the original, not away from it.
- **Annotations are the product.** The article text is the substrate; your highlights and commentary are what make the shared link valuable. Without the annotations, there's no reason to use Annotate over just visiting the article directly.
- **No indexing, no public listing.** Annotated views are private, shareable links — not publicly indexed content. This isn't a publishing platform.

---

## Architecture Overview

The system has three layers:

```
┌─────────────────────────────────────┐
│         Frontend (Next.js)          │
│  - Article reading view             │
│  - Highlight creation UI            │
│  - Margin comment display           │
│  - Share link generation            │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│        Backend API (Next.js)        │
│  - Article ingestion & parsing      │
│  - Annotation CRUD                  │
│  - Share link management            │
│  - User authentication              │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│       Database (PostgreSQL)         │
│  - Articles (structured paragraphs) │
│  - Annotations (highlights + notes) │
│  - Users & shared links             │
└─────────────────────────────────────┘
```

---

## Tech Stack Recommendation

| Layer | Technology | Why |
|---|---|---|
| Framework | **Next.js (App Router)** | Full-stack React framework. Handles both the frontend reading view and the backend API in one project. Large ecosystem, great DX. |
| Language | **TypeScript** | Type safety across the full stack prevents a whole class of bugs, especially important for the annotation data model. |
| API Layer | **tRPC** | End-to-end type-safe API without manually defining routes or schemas. You define a procedure on the backend and the frontend automatically knows its input/output types. Uses TanStack Query under the hood, giving you caching, optimistic updates, and loading states for free. |
| Database | **PostgreSQL via Supabase or Railway** | Supabase gives you hosted Postgres plus built-in auth and row-level security. Alternatively, Railway offers managed Postgres alongside your app deployment — simpler infrastructure if you handle auth separately (e.g., with NextAuth.js). Both work well at the 10–100 user scale. |
| ORM | **Drizzle ORM** | A lightweight, SQL-first TypeScript ORM. You define your schema directly in TypeScript (no separate schema language, no code generation step). Changes to your schema are immediately reflected in your types. Its tiny bundle size (~7.4kb) makes it ideal for serverless deployment on Vercel, avoiding the cold-start overhead that heavier ORMs introduce. |
| Validation | **Zod** | Schema validation library that integrates natively with tRPC for input validation. Define your input shapes once and get both runtime validation and TypeScript types. |
| Article Parsing | **@mozilla/readability + jsdom** | The same engine behind Firefox's Reader View. Battle-tested extraction of article content from messy web pages. |
| Styling | **Tailwind CSS** | Utility-first CSS that makes it easy to build the reading view and comment UI without fighting a component library. |
| Deployment | **Vercel or Railway** | Vercel offers zero-config Next.js deployment. Railway can host both the Next.js app and a managed PostgreSQL database in one place, simplifying your infrastructure. Both have generous free/starter tiers for this scale. |

### Why this stack fits

**Next.js + tRPC + Drizzle** is often called the "T3-adjacent" stack and is one of the most popular choices for solo/small-team TypeScript projects. The key advantage is a completely type-safe chain from database to UI:

1. **Drizzle** defines your tables in TypeScript and infers types from them — no code generation step.
2. **tRPC** exposes your database operations as typed procedures — no REST routes, no API contracts to maintain.
3. **Next.js** renders the frontend, calling tRPC procedures directly with full autocomplete and type checking.

If you rename a field in your Drizzle schema, TypeScript immediately flags every tRPC procedure and every frontend component that references it. This tight feedback loop is especially valuable when you're iterating quickly as a solo developer.

### A note on future scalability

tRPC is optimized for tightly-coupled frontend/backend apps. If you ever need to expose a public API (e.g., for a browser extension or third-party integrations), you can add standard REST endpoints alongside tRPC — they coexist fine in Next.js. For the current 10–100 user scope, tRPC is the fastest path to a working product.

---

## Data Model

### Articles

```
Article
├── id              (uuid, primary key)
├── sourceUrl       (text, the original article URL)
├── title           (text)
├── author          (text, nullable)
├── siteName        (text, nullable)
├── publishedDate   (timestamp, nullable)
├── createdAt       (timestamp)
└── paragraphs      (jsonb array)
    └── [{ id: "p-0", text: "...", html: "..." }, ...]
```

**Why store paragraphs as structured JSON?** Annotations reference specific text positions within paragraphs. By giving each paragraph a stable ID at ingestion time, highlights can reliably point to the right location even if we re-process the article later.

### Annotations

```
Annotation
├── id                (uuid, primary key)
├── articleId         (foreign key → Article)
├── creatorId         (foreign key → User)
├── startParagraphId  (text, references paragraph.id)
├── startOffset       (integer, character offset within paragraph)
├── endParagraphId    (text)
├── endOffset         (integer)
├── highlightedText   (text, the selected snippet — for preview/search)
├── comment           (text, the user's commentary)
├── color             (text, highlight color — for future multi-user support)
├── createdAt         (timestamp)
└── updatedAt         (timestamp)
```

**On text anchoring:** Character offsets within paragraphs are the simplest anchoring strategy and work well when you control the text extraction. Since we parse the article once and store the result, the offsets won't drift. This is simpler than XPath-based or fuzzy text matching approaches, which are needed for browser extensions but overkill here.

### Users

```
User
├── id          (uuid, primary key)
├── email       (text, unique)
├── name        (text)
├── createdAt   (timestamp)
```

### Shared Links

```
SharedLink
├── id            (text, short slug like "a7x9k2" — used in URL)
├── articleId     (foreign key → Article)
├── creatorId     (foreign key → User)
├── createdAt     (timestamp)
```

A shared link gives read access to the article and all annotations by that creator. No auth required to view — anyone with the link can read.

---

## Key Implementation Details

### 1. Article Ingestion Pipeline

When a user pastes a URL:

1. **Fetch the page** server-side using `fetch` or a headless browser for JS-rendered pages.
2. **Extract content** with Mozilla's Readability.js, which returns: title, author, content (HTML), text content, site name, excerpt.
3. **Structure into paragraphs.** Parse the HTML content, split on block-level elements (`<p>`, `<h1>`–`<h6>`, `<blockquote>`, `<li>`), assign each a stable ID, and store both the plain text and cleaned HTML.
4. **Store the article** with metadata and structured paragraphs.

**Edge cases to handle:**
- Paywalled articles: the fetch will return a truncated version or login page. Detect this (check for common paywall indicators like truncated content length) and show a clear error.
- JavaScript-rendered content: some sites load article content via JS. Start with a simple `fetch`; if that fails to extract meaningful content, consider adding Puppeteer/Playwright as a fallback.
- Duplicate URLs: if someone pastes the same URL, check if it's already been ingested. Reuse the existing article record but create new annotations.

### 2. Text Selection & Highlight Creation

This is the most interactive part of the frontend. The flow:

1. User selects text in the reading view (native browser selection).
2. On `mouseup`/`touchend`, capture the selection using `window.getSelection()`.
3. Map the browser selection to your paragraph model: identify which paragraph(s) the selection spans, and calculate the character offsets within each.
4. Show a floating toolbar or popover near the selection with a "Add Comment" button.
5. User types their comment, saves it.
6. The highlight renders as a colored background span within the paragraph text, and the comment appears in the margin.

**Important UX details:**
- Highlights should not interfere with further text selection.
- Overlapping highlights need a visual strategy (slightly darker overlap zone, or stack colors).
- On mobile, the margin comment pattern doesn't work well. Consider an inline expand pattern instead (tap highlight → comment slides in below).

### 3. Reading View with Margin Comments

The reading view layout is a two-column design on desktop:

```
┌────────────────────────────────┬──────────────┐
│                                │              │
│   Article text with            │  Comment A   │
│   highlighted passages         │              │
│   rendered inline.             │              │
│                                │  Comment B   │
│   The highlights use a soft    │              │
│   background color.            │              │
│                                │              │
│                                │  Comment C   │
│                                │              │
└────────────────────────────────┴──────────────┘
```

Each comment is vertically aligned with its corresponding highlight. When highlights are close together, comments need collision avoidance (push subsequent comments down so they don't overlap).

**On mobile:** switch to a single-column layout where tapping a highlight opens the comment as an inline card or bottom sheet.

### 4. Sharing Flow

1. User clicks "Share" on an annotated article.
2. Backend generates a short slug (`nanoid` library, 8 characters).
3. User gets a link like `annotate.app/s/a7x9k2`.
4. Anyone with the link sees the reading view with all highlights and comments. No login required.

---

## Implementation Phases

### Phase 1 — Core MVP (Weeks 1–3)

The goal is a working end-to-end flow: paste URL → see article → add highlights → share link.

**Week 1: Project Setup & Article Ingestion**
- Initialize Next.js project with TypeScript, Tailwind, Prisma.
- Set up Supabase project and database schema.
- Build the article ingestion API endpoint: accepts a URL, fetches and parses with Readability, stores structured paragraphs.
- Build a simple "paste URL" page that triggers ingestion and shows the parsed article.

**Week 2: Annotations & Reading View**
- Build the reading view component that renders structured paragraphs.
- Implement text selection handling and the highlight creation flow.
- Build the margin comment layout with vertical alignment.
- Store and retrieve annotations from the database.

**Week 3: Sharing & Polish**
- Implement the share link system (slug generation, public read route).
- Add the source attribution banner.
- Mobile responsive layout (switch from margin comments to inline).
- Basic error handling (invalid URLs, failed fetches, paywall detection).

### Phase 2 — Multi-User Foundation (Weeks 4–5)

Enable other people to create their own annotations, not just view yours.

- Add authentication (Supabase Auth, NextAuth.js, or similar — depending on your database choice).
- Scoped annotations: each user's highlights are stored separately.
- On the reading view, show annotations grouped by creator (your highlights vs. a friend's).
- "Create your own annotations" button on shared views for logged-in users.
- User settings page (display name, default highlight color).

### Phase 3 — Enhanced Experience (Weeks 6–8)

- **Annotation reactions:** friends can "like" or emoji-react to your comments without creating full annotations.
- **Collections:** group annotated articles into named collections (like a reading list with commentary).
- **Improved parsing:** add Puppeteer fallback for JS-rendered sites; better handling of images and embedded media in the reading view.
- **Search:** search across your annotations and highlighted text.
- **Export:** export your annotations as markdown or JSON for use outside the app.

---

## Multi-User Considerations

Since you want to start single-user but plan for multi-user, here are the architectural decisions to make *now* so you don't have to rewrite later:

1. **Always associate annotations with a user ID.** Even in Phase 1 when you're the only user, store a `creatorId` on every annotation. Use a hardcoded user record for now; swap in real auth later.

2. **Row-level security from day one.** If using Supabase, its built-in RLS makes this easy. If using Railway Postgres directly, enforce access control in your API layer instead. Either way, ensure annotations are writable only by their creator but readable by anyone with a valid shared link.

3. **Namespace articles by ingestion, not globally.** Two users might annotate the same article. You have two choices: (a) share a single article record and keep annotations separate, or (b) let each user have their own copy. Option (a) is more storage-efficient and enables features like "see what others highlighted," but requires more careful access control. Recommended: start with (a) since your structured paragraphs are deterministic for a given URL.

4. **Color-code by user.** Assign each user a highlight color. When multiple users annotate the same article, their highlights are visually distinct. Plan for this in your annotation data model (the `color` field).

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Readability fails to parse some sites cleanly | High | Implement a "paste raw text" fallback for problematic articles. Show a preview step after parsing so you can catch issues before annotating. |
| Text selection mapping is tricky across paragraph boundaries | Medium | Start by only supporting single-paragraph selections. Cross-paragraph highlighting is a Phase 2 feature. |
| Highlight offset drift if article is re-ingested | Low | Store the article snapshot at ingestion time and never re-fetch. Offsets are stable against a fixed snapshot. |
| Sites block server-side fetching (bot detection) | Medium | Use realistic HTTP headers. For stubborn sites, consider a "paste article text" manual mode. |
| Mobile UX for comments is poor | Medium | Design mobile-first with inline comments. Don't try to force the margin layout on small screens. |

---

## Open Questions for Future Consideration

- **Notifications:** Should friends get notified when you share an annotated article? (Email? Push?)
- **Privacy levels:** Public link vs. invite-only vs. password-protected?
- **API access:** Should there be a public API so others can build on top of Annotate?
- **Browser extension (later):** Once the core app works, a lightweight extension that lets you highlight directly on any page (and sends data to Annotate's backend) could improve the annotation UX significantly. This becomes viable once you have a user base that's bought into the concept.

---

## Implementation Checklist

### Infrastructure & Setup
- [x] Create Next.js project with TypeScript and Tailwind CSS (App Router)
- [x] Set up Supabase project (hosted Postgres + Auth)
- [x] Define Drizzle schema (`users`, `articles`, `annotations`, `sharedLinks`)
- [x] Configure Drizzle ORM + `postgres` driver (`src/db/schema.ts`, `src/db/index.ts`)
- [x] Set up tRPC v11 with TanStack Query (`src/server/trpc.ts`, `src/trpc/provider.tsx`)
- [x] Wire up tRPC routers: `articles`, `annotations`, `sharedLinks`
- [x] Set up Supabase auth context in tRPC (`protectedProcedure`)
- [x] Fill in `.env.local` with real Supabase credentials
- [x] Run `npm run db:push` to push schema to Supabase Postgres
- [ ] Deploy to Railway

### Article Ingestion
- [x] Install `@mozilla/readability` + `jsdom`
- [x] Build `/api/ingest` endpoint — fetch URL, parse with Readability, split into structured paragraphs, store in DB
- [x] Dedup by source URL (reuse existing article record if already ingested)
- [ ] Test ingestion with 5–10 different article URLs
- [ ] Puppeteer/Playwright fallback for JS-rendered sites (Phase 2)

### Homepage (URL Input)
- [x] Cream/ink/amber editorial design with Lora serif font
- [x] URL paste input form with loading state and error handling
- [x] POST to `/api/ingest`, redirect to `/article/[id]` on success
- [x] Example article pills (Paul Graham, The Atlantic, Wait But Why)

### Reading View (`/article/[id]`)
- [x] Fetch article from DB by ID (tRPC or direct DB call in Server Component)
- [x] Render structured paragraphs (headings, body, blockquotes, lists)
- [x] Source attribution banner (title, author, site name, link to original)
- [x] Typography and spacing matching the editorial aesthetic

### Highlight & Annotation UI
- [x] Text selection handler (`mouseup` / `touchend`, `window.getSelection()`)
- [x] Map browser selection to paragraph model (paragraph ID + character offsets)
- [x] Floating toolbar / popover on selection ("Add Comment" button)
- [x] Comment input and save flow (tRPC `annotations.create`)
- [x] Render highlights as colored `<mark>` spans inline in paragraph text
- [x] Load and display existing annotations on article load

### Margin Comment Layout
- [x] Two-column layout: article text (left) + comment sidebar (right)
- [x] Vertically align each comment card with its corresponding highlight
- [x] Collision avoidance (push comments down when highlights are close)
- [x] Mobile: single-column, tap highlight → inline comment card or bottom sheet

### Sharing
- [x] "Share" button on annotated article view
- [x] tRPC `sharedLinks.create` — generate 8-char nanoid slug, store in DB
- [x] Public read route `/s/[slug]` — read-only annotated view, no auth required
- [x] Source attribution banner on shared view

### Auth
- [x] Supabase Auth integration (email magic link)
- [x] Sign in / sign up UI (`/auth`)
- [x] Protect annotation creation behind auth
- [x] User record sync (create `users` row on first auth via `/auth/callback`)

### Pre-Production Hardening

**Security**
- [x] SSRF protection in `/api/ingest` — validate URL resolves to a public IP, reject localhost / private ranges / non-HTTP(S) schemes
- [x] Require auth on `/api/ingest` — only logged-in users can trigger article ingestion (prevents DB spam)
- [x] Cap fetch response size in ingest — stop reading after e.g. 5 MB to prevent memory spikes from huge pages

**Reliability**
- [x] Mark `jsdom` + `@mozilla/readability` as `serverExternalPackages` in `next.config.ts` — prevents bundling into the edge runtime, fixes cold-start issues on Vercel
- [x] Add annotation deletion — users need a way to remove an annotation they created

**UX polish**
- [x] Per-article `<title>` and `<meta description>` tags (Server Component metadata export)
- [x] Custom `not-found.tsx` and `error.tsx` pages
- [x] Annotation cards on the right always have a white background and visible border (not transparent)

### Library (`/library`)
- [x] List all articles the user has annotated, with annotation count
- [x] Share button per article — generates a share link from the library view
- [x] Delete button per article — removes all user annotations for that article, with confirmation

**Deployment**
- [ ] Add production env vars to Railway/Vercel (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DATABASE_URL`)
- [ ] Add production domain to Supabase redirect URL whitelist
- [ ] Deploy to Railway