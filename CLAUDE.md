# Between Us — Shared Expense Tracker

## Project Overview

Between Us is a web application for two partners who share household expenses but maintain separate bank accounts. The app tracks who paid for what, handles 50/50 splits and full reimbursements, and calculates a monthly settlement so one person can pay the other a single amount.

The product optimizes for:

- Clean, polished, intuitive UI — this should feel like a real product, not a side project
- Speed of expense entry — users log expenses frequently, so the flow must be fast
- Accurate settlement calculations — the whole point is knowing who owes whom
- Simplicity — two users, hierarchical tags, no over-engineering

## Tech Stack

- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Components:** ShadCN/ui
- **Database:** MongoDB (hosted on NAS, accessed via network)
- **ODM:** Mongoose
- **Auth:** Auth.js with simple person selector (no passwords, no OAuth)
- **Deployment:** Docker container on NAS

Do NOT introduce:

- Redux or other state management libraries (React context and server state are sufficient)
- CSS-in-JS libraries (Styled Components, Emotion, etc.)
- Alternative component libraries (Material UI, Chakra, Ant Design)
- ORMs other than Mongoose

## Architecture

```ascii
src/
├── app/                    # Next.js App Router pages and layouts
│   ├── (auth)/             # Auth-related pages (login)
│   ├── (dashboard)/        # Protected app pages
│   │   ├── expenses/       # Expense entry and listing
│   │   ├── reports/        # Reporting and date-range queries
│   │   ├── settlement/     # Monthly close-out and settlement
│   │   ├── recurring/      # Recurring expense templates
│   │   └── admin/          # Admin-only pages (tag management, CSV formats, people)
│   ├── api/                # API route handlers
│   └── layout.tsx          # Root layout
├── components/
│   ├── ui/                 # ShadCN/ui components (generated)
│   └── ...                 # App-specific shared components
├── lib/
│   ├── db.ts               # MongoDB/Mongoose connection
│   ├── models/             # Mongoose schemas and models
│   └── utils.ts            # Shared utility functions
├── types/                  # TypeScript type definitions
└── hooks/                  # Custom React hooks
```

### Data Model

**Expense:**

- `paidBy` — which user paid (Partner A or Partner B)
- `date` — date of the expense
- `tags` — one or more tags (refs to Tag), at least one required
- `amount` — dollar amount (stored as cents)
- `where` — free-form merchant/location (e.g., "Publix", "Amazon", "FPL")
- `notes` — optional description
- `splitType` — "split" (50/50) or "full" (fully reimbursed to payer)
- `settlementType` — "immediate" or "deferred"
  - **Immediate:** settled at time of expense. Excluded from monthly settlement totals.
  - **Deferred:** accumulated and settled monthly.
- `createdAt` / `updatedAt` — timestamps

**Tag:**
Tags are hierarchical labels for organizing expenses. Tags use slash-separated paths (e.g., "Vacation/Italy 2026"). Both users can create tags on-the-fly; only the admin can rename, delete, or reorder tags. Tags are case-insensitive (enforced via MongoDB collation).

- `path` — full path string (e.g., "Bills/Electric"), unique (case-insensitive)
- `sortOrder` — display order in dropdowns and reports
- Computed fields (via serialization): `name` (last segment), `parent` (prefix), `depth`

**RecurringTemplate:**
A template represents a group of one or more expenses that are submitted together. For example, a "Monthly Bills" template might contain electric, internet, and water bills as separate line items.

- `name` — template name (e.g., "Monthly Bills")
- `items` — array of expense entries:
  - `paidBy` — default payer
  - `tagIds` — default tags
  - `amount` — default amount
  - `notes` — default description
  - `splitType` — default split type
  - `settlementType` — default settlement type

**Settlement:**

- `month` / `year` — the period being settled
- `totalOwed` — net amount owed
- `owedBy` — which user owes
- `owedTo` — which user is owed
- `closedAt` — timestamp when month was closed

### Settlement Logic

When "Close the Month" is triggered:

1. Gather all **deferred** expenses for the month
2. For each expense, calculate the amount the non-payer owes:
   - Split: half the amount
   - Full reimburse: the full amount
3. Sum what Partner A owes Partner B and what Partner B owes Partner A
4. Net the two amounts: "Partner A owes Partner B $X" or "Partner B owes Partner A $X"

Expenses with `settlementType: "immediate"` are shown separately in reports but excluded from the monthly settlement calculation.

## Coding Rules

- Use functional React components with hooks — no class components
- Prefer Next.js Server Components where possible; use `"use client"` only when the component needs interactivity or browser APIs
- Use TypeScript strict mode — no `any` types unless absolutely unavoidable
- Use Tailwind utility classes for styling — no custom CSS files
- Use ShadCN/ui components as the building blocks for all UI elements
- Form validation with React Hook Form + Zod schemas
- All monetary values stored as cents (integers) to avoid floating-point issues
- API routes should validate input and return consistent error shapes
- Keep components small and focused — extract when a component exceeds ~100 lines

## Design System

- Follow ShadCN/ui default theme and patterns
- Use consistent spacing: Tailwind's spacing scale (p-4, gap-6, etc.)
- Desktop-primary layout with responsive support for mobile and tablet
- Tested browsers: Chrome and Edge on Windows, Chrome and Safari on macOS
- All forms must be fully operable by keyboard alone (tab order, Enter to submit, Escape to cancel) — one user prefers keyboard-driven input
- All forms must also work intuitively with mouse/trackpad — the other user prefers mouse-driven input
- Use ShadCN's toast/sonner for success/error feedback
- Use ShadCN's dialog for confirmations (e.g., closing a month)

## Fallow (Codebase Intelligence)

Fallow is installed as a dev dependency with an MCP server at `./node_modules/.bin/fallow-mcp`. Use fallow's MCP tools during feature work:

- **Before implementing:** query fallow for the health and complexity of files you're about to touch. Flag if a file is already a complexity hotspot or has high churn — suggest extracting before adding more logic.
- **After implementing:** run `fallow audit` against the working changes to catch dead code, unused exports, new circular dependencies, or complexity regressions before the PR is opened.

Config is in `.fallowrc.json`. `src/components/ui/**` is excluded (generated ShadCN code).

## Commands

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript compiler check
npm run fallow       # Run all fallow analyses (dead-code, dupes, health)
npm run fallow:audit # Audit working changes against base branch
```

## Docker

The app runs as a Docker container on a NAS alongside an existing MongoDB instance.

```bash
docker build -t between-us .
docker run -p 3000:3000 --env-file .env between-us
```

## Environment Variables

```bash
MONGODB_URI=mongodb://<nas-ip>:27017/between-us
AUTH_SECRET=<generated-secret>
```

