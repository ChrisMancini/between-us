# Between Us

[![CI](https://github.com/ChrisMancini/between-us/actions/workflows/ci.yml/badge.svg)](https://github.com/ChrisMancini/between-us/actions/workflows/ci.yml)

> **Note:** This application was built as a learning project to explore AI-assisted development with [Claude Code](https://docs.anthropic.com/en/docs/claude-code). The entire codebase — from architecture decisions to implementation — was developed collaboratively with Claude as a way to understand the workflow of building software with an AI coding agent.

A shared expense tracker for two partners who share household expenses but maintain separate bank accounts. Between Us tracks who paid for what, handles 50/50 splits and full reimbursements, and calculates a monthly settlement so one person can pay the other a single amount.

## Features

### Dashboard

- At-a-glance current month spending summary with deferred/immediate and per-person breakdown
- Settlement status showing who owes whom and whether the month is open or closed
- Recent expenses across all months
- Quick-action links to log expenses, view reports, and manage settlement

### Expense Tracking

- Log expenses with category, amount, merchant/location, and optional notes
- Assign each expense to the person who paid
- Mark expenses as 50/50 split or full reimbursement
- Edit and delete expenses
- Filter expenses by month, category, payer, and merchant search
- Month-by-month expense list with category and payer badges

### Monthly Settlement

- One-click month close calculates the net amount owed between partners
- Separates expenses into "settled monthly" (deferred) and "settled immediately" (e.g. mortgage)
- Reopen a closed month to add corrections, then re-close
- Settlement history page showing all past closed months at a glance
- Alerts for reopened months and unsettled past months

### Reports

- Monthly spending summary with deferred/immediate breakdown
- Category breakdown with visual bar charts
- Person-by-category matrix showing who paid what, with expandable drill-down to individual expenses
- 6-month spending trend table

### Recurring Templates

- Create templates for groups of expenses entered together each month (e.g. "Monthly Bills")
- Each template contains one or more expense line items with default values
- Apply a template to quickly create expenses for a given month with editable amounts
- Templates are scoped per user

### CSV Import

- Import expenses directly from credit card CSV exports (Citi, Chase, or any card)
- Admin-defined CSV format profiles with column mappings for date, description, and amount
- Supports both separate Debit/Credit columns (Citi) and single Amount columns (Chase)
- Optional category column mapping — map CSV categories to app categories automatically
- Interactive preview table: select/deselect rows, edit descriptions, set categories and split types
- Bulk actions to set category or split type across all selected rows
- Automatic duplicate detection — flags expenses that match existing entries by date and amount
- Payments and credits are automatically excluded (only purchases are imported)
- Available to both users from the Expenses page

### Authentication

Two authentication methods are available, chosen during initial setup and changeable anytime from the admin page:

- **Person Selector (default):** Simple click-to-sign-in with no passwords — ideal for home/LAN deployments where the app is only accessible on a trusted network.
- **OAuth:** Sign in with an external identity provider. Set the provider's environment variables, restart the app, and select the provider during setup or in admin settings.

**Supported OAuth providers:** Google, GitHub, Microsoft, Apple, Discord, Facebook, LinkedIn, GitLab, Slack, and Twitter. Any provider with its environment variables configured will appear automatically in the setup wizard and admin settings.

**Per-provider email mapping:** Each person can have a separate email address per provider (e.g. a Google email and a GitHub email). When you switch providers in admin settings, existing email mappings for other providers are preserved — switching back is seamless.

**Adding a new OAuth provider:** The provider registry lives in `src/lib/auth-providers.ts`. To add a provider:

1. Install the provider if needed (all 10 built-in providers ship with `next-auth`)
2. Add an import and a new entry to the `PROVIDER_REGISTRY` object:

   ```typescript
   import Okta from "next-auth/providers/okta";
   // ...
   okta: {
     name: "Okta",
     envKeys: ["OKTA_CLIENT_ID", "OKTA_CLIENT_SECRET"],
     createProvider: (clientId, clientSecret) => Okta({ clientId, clientSecret }),
   },
   ```

3. Add a brand icon entry in `src/components/provider-icon.tsx`:

   ```typescript
   import { SiOkta } from "react-icons/si";
   // ...
   okta: SiOkta,
   ```

   Icons come from `react-icons` — check the [Simple Icons set](https://react-icons.github.io/react-icons/icons/si/) first, then fall back to Font Awesome (`react-icons/fa`). If no icon is available, the component falls back to a generic shield icon automatically.

4. Set the environment variables and restart — the provider appears automatically in setup and admin

### Admin

- Category management: add, edit, reorder, and delete expense categories
- CSV format management: define column mappings for different credit card CSV exports  
- Authentication settings: switch between person selector and OAuth, manage provider and email mappings
- Admin-only access enforced at both the UI and API level

## Tech Stack

- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Components:** ShadCN/ui (Base UI)
- **Database:** MongoDB
- **ODM:** Mongoose
- **Auth:** Auth.js with configurable authentication (person selector or OAuth)
- **Deployment:** Docker

## Getting Started

```bash
npm install
npm run dev
```

### Environment Variables

```bash
MONGODB_URI=mongodb://<host>:27017/between-us
AUTH_SECRET=<generated-secret>

# OAuth providers (optional — set the pair for any provider you want to use)
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
# GITHUB_ID=
# GITHUB_SECRET=
# MICROSOFT_ENTRA_ID_ID=
# MICROSOFT_ENTRA_ID_SECRET=
# APPLE_ID=
# APPLE_SECRET=
# DISCORD_CLIENT_ID=
# DISCORD_CLIENT_SECRET=
# FACEBOOK_CLIENT_ID=
# FACEBOOK_CLIENT_SECRET=
# LINKEDIN_CLIENT_ID=
# LINKEDIN_CLIENT_SECRET=
# GITLAB_CLIENT_ID=
# GITLAB_CLIENT_SECRET=
# SLACK_CLIENT_ID=
# SLACK_CLIENT_SECRET=
# TWITTER_CLIENT_ID=
# TWITTER_CLIENT_SECRET=
```

### Docker

```bash
node build.mjs                                # builds and tags with version from package.json
docker run -p 3000:3000 --env-file .env between-us:latest
```

## Releasing a New Version

This project uses git tags and GitHub Releases to track versions. The version number in `package.json` is baked into the app footer at build time along with the git commit hash and build date.

### Creating a Release

1. **Bump the version:**

   ```bash
   npm version patch   # 0.1.0 → 0.1.1 (bug fixes)
   npm version minor   # 0.1.0 → 0.2.0 (new features)
   npm version major   # 0.1.0 → 1.0.0 (breaking changes)
   ```

   This updates `package.json`, creates a git commit, and tags it (e.g., `v0.1.1`).

2. **Push the commit and tag:**

   ```bash
   git push && git push --tags
   ```

3. **Create a GitHub Release:**

   Go to the repository's **Releases** page → **Draft a new release** → select the tag → write release notes → **Publish release**.

4. **Deploy:** Build and deploy the Docker image to your NAS (see [Updating the Application](#updating-the-application) below).

## Deploying to Synology NAS

These steps assume you have **Container Manager** installed on your Synology NAS and MongoDB already running (either as a container or standalone).

### 1. Build and export the image

On your development machine:

```bash
node build.mjs
docker save between-us:latest -o between-us.tar
```

### 2. Transfer the image to your NAS

Copy `between-us.tar` to your NAS via a network share (e.g., `\\NAS\docker\`) or SCP:

```bash
scp between-us.tar your-user@nas-ip:/tmp/
```

### 3. Import the image

1. Open **Container Manager** in DSM
2. Go to **Image** in the left sidebar
3. Click **Import** > **Add from file**
4. Select the `between-us.tar` file and wait for the import to finish

### 4. Create the container

1. Go to **Container** in the left sidebar
2. Click **Create** and select the `between-us:latest` image
3. Configure the following:
   - **Container name:** `between-us`
   - **Port:** Map local port `3000` to container port `3000`
   - **Environment variables:**
     - `MONGODB_URI` = `mongodb://<nas-ip>:27017/between-us` (must start with `mongodb://` — no quotes, no extra characters)
     - `AUTH_SECRET` = a generated secret (run `openssl rand -base64 32`)
     - *(Optional)* OAuth provider credentials — see [Environment Variables](#environment-variables) for the full list of supported providers
   - **Restart policy:** `always` (survives NAS restarts)
4. Click **Apply** / **Done**

### 5. Verify

Open `http://<nas-ip>:3000` in a browser. You should see the login page.

### Troubleshooting

- **`UntrustedHost` errors in logs:** Auth.js may reject requests from unrecognized hostnames (e.g., `data.local`). The app sets `trustHost: true` by default, which is appropriate for a self-hosted LAN deployment. If you still see this error, add the environment variable `AUTH_TRUST_HOST=true` to the container.
- **`MongoParseError: Invalid scheme`:** The `MONGODB_URI` value is malformed. It must start with `mongodb://` — verify there are no extra quotes, spaces, or missing scheme prefix in the container's environment variables.
- **`Cannot read properties of undefined (reading 'role')`:** This is a cascade from auth or database connection failures. Fix the underlying `UntrustedHost` or `MongoParseError` issue first.

### Notes

- **MongoDB connectivity:** If MongoDB runs as a container on the same NAS, use the NAS LAN IP or a shared Docker network — not `localhost` (which inside the container refers to the container itself). If both containers share a Docker network, you can use the MongoDB container name as the hostname.
- **Docker network:** Create a shared network in Container Manager under **Network** and assign both the MongoDB and Between Us containers to it.

### Updating the Application

When you have new changes to deploy:

**1. Build and export the new image** (on your development machine):

```bash
node build.mjs
docker save between-us:latest -o between-us.tar
```

**2. Transfer** `between-us.tar` to your NAS (same as initial setup — network share or SCP).

**3. Import the updated image:**

1. Open **Container Manager** > **Image**
2. Click **Import** > **Add from file** and select the new `between-us.tar`
3. When prompted that the image already exists, confirm to overwrite it

**4. Replace the running container:**

1. Go to **Container** in the left sidebar
2. Select the `between-us` container and click **Stop**
3. With the container still selected, click **Action** > **Reset** — this recreates the container from the updated image while preserving your settings (port mappings, environment variables, restart policy)
4. Click **Start**

**5. Verify** by refreshing `http://<nas-ip>:3000` in a browser.

> **Note:** Reset preserves container settings but clears any data stored inside the container filesystem. This app stores all data in MongoDB (external), so nothing is lost.
