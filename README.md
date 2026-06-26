# Between Us

> **Note:** This application was built as a learning project to explore AI-assisted development with [Claude Code](https://docs.anthropic.com/en/docs/claude-code). The entire codebase — from architecture decisions to implementation — was developed collaboratively with Claude as a way to understand the workflow of building software with an AI coding agent.

A shared expense tracker for two partners who share household expenses but maintain separate bank accounts. Between Us tracks who paid for what, handles 50/50 splits and full reimbursements, and calculates a monthly settlement so one person can pay the other a single amount.

## Features

### Dashboard

- At-a-glance current month spending summary with deferred/immediate and per-person breakdown
- Settlement status showing who owes whom and whether the month is open or closed
- Recent expenses across all months
- Quick-action links to log expenses, view reports, and manage settlement

### Expense Tracking

- Log expenses with tags, amount, merchant/location, settlement type, and optional notes
- Assign each expense to the person who paid
- Tag expenses with one or more hierarchical tags (e.g., "Vacation/Italy 2026")
- Create tags on the fly while entering expenses
- Mark expenses as 50/50 split or full reimbursement
- Choose settlement type per expense: deferred (monthly) or immediate
- Edit unsettled expenses you created (all fields except payer)
- Delete unsettled expenses you created, with confirmation dialog
- Filter expenses by month, tag (hierarchical — selecting a parent matches descendants), payer, and merchant search
- Month-by-month expense list with tag and payer badges

### Monthly Settlement

- Ready-to-settle gate: both people must mark themselves as "done entering expenses" before the month can be closed
- Expense changes (add, edit, delete, import, template apply) auto-reset the done flag for the affected month
- Reopening a closed month resets both done flags
- One-click month close calculates the net amount owed between partners
- Separates expenses into "settled monthly" (deferred) and "settled immediately" (e.g. mortgage)
- Reopen a closed month to add corrections, then re-close
- Settlement history page showing all past closed months at a glance
- Alerts for reopened months and unsettled past months

### Reports

- Monthly spending summary with deferred/immediate breakdown
- Tag breakdown with visual bar charts (groupable by tag level)
- Person-by-tag matrix showing who paid what, with expandable drill-down to individual expenses
- 6-month spending trend table

### Year in Review

- Annual spending summary accessible from the Reports page
- Year navigation with prev/next controls
- Reuses the same spending summary, tag breakdown, and trend components as monthly reports
- Annual highlights: biggest single expense, most frequent merchant, and busiest month
- Who-paid-more visual bar showing each person's share of total spending
- Annual settlement summary netting all closed months into a single total

### Recurring Templates

- Create templates for groups of expenses entered together each month (e.g. "Monthly Bills")
- Each template contains one or more expense line items with default values
- Apply a template to quickly create expenses for a given month with editable amounts
- Templates are scoped per user

### Activity Feed

- See what your partner has been doing — every expense, edit, deletion, settlement, template application, and CSV import is logged
- Dashboard widget shows the 5 most recent partner activities at a glance
- Dedicated `/activity` page with full history and cursor-based pagination
- Filter toggle: view partner-only activity (default) or switch to all activity
- Toast notifications — when your partner does something, a toast pops up within 30 seconds (polling-based, no WebSocket infrastructure needed)
- Each activity shows an action icon, person badge, summary text, and relative timestamp

### CSV Import

- Import expenses directly from credit card CSV exports (Citi, Chase, or any card)
- Admin-defined CSV format profiles with column mappings for date, description, and amount
- Supports both separate Debit/Credit columns (Citi) and single Amount columns (Chase)
- Optional tag column mapping — map CSV categories to app tags automatically
- Interactive preview table: select/deselect rows, edit descriptions, set tags and split types
- Bulk actions to set tag or split type across all selected rows
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

- Tag management: add, edit, reorder, and delete hierarchical expense tags
- CSV format management: define column mappings for different credit card CSV exports
- People management: view people and swap admin/user roles
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
docker run -p 3000:3000 --env-file .env ghcr.io/chrismancini/between-us:latest
```

## Releasing a New Version

This project uses git tags and GitHub Releases to track versions. The version number in `package.json` is baked into the app footer at build time along with the git commit hash and build date.

### Creating a Release

1. **Bump the version** in your feature or bug branch:

   ```bash
   npm version patch   # 0.1.0 → 0.1.1 (bug fixes)
   npm version minor   # 0.1.0 → 0.2.0 (new features)
   npm version major   # 0.1.0 → 1.0.0 (breaking changes)
   ```

   This updates `package.json` and creates a local commit. Don't push the git tag it creates — the publish workflow creates the official tag on merge.

2. **Merge to master** — the PR version check enforces that the version is bumped before merging.

3. **GitHub Actions handles the rest** — on merge, the publish workflow automatically creates the git tag, publishes a GitHub Release, and builds and pushes the Docker image to `ghcr.io`.

4. **Deploy to NAS:**

   ```bash
   node deploy.mjs
   ```

## Deploying to Synology NAS

These steps assume you have **Container Manager** installed on your Synology NAS and MongoDB already running (either as a container or standalone).

### 0. Set up SSH access (one-time)

`deploy.mjs` connects to your NAS over SSH. Add a `nas` host alias to `~/.ssh/config`:

```
Host nas
  HostName <your-nas-ip>         # e.g. 192.168.1.100
  User <your-dsm-username>       # your Synology DSM login — may differ from your Windows username
```

Optionally set up passwordless login so you aren't prompted for a password on each deploy:

```bash
# Generate a key pair if you don't have one
ssh-keygen -t ed25519
```

**macOS / Linux:**
```bash
ssh-copy-id nas
```

**Windows (PowerShell):**
```powershell
Get-Content "$env:USERPROFILE\.ssh\id_ed25519.pub" | ssh nas "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && chmod 700 ~/.ssh"
```

Make sure SSH is enabled on the NAS: **DSM → Control Panel → Terminal & SNMP → Enable SSH service**.

> **Synology gotcha:** If key auth is set up correctly but SSH still prompts for a password, the home directory is likely world-writable (Synology's default). SSH rejects `authorized_keys` in this case. Fix it by SSHing in with your password and running `chmod 755 ~`. Note that DSM updates may reset this — if key auth stops working after an update, rerun the same command.

#### Allow passwordless sudo for Docker (one-time)

The Docker socket on Synology is root-only. `deploy.mjs` uses `sudo` to run Docker commands, but `sudo` must be configured to not require a password for non-interactive SSH sessions. SSH into the NAS interactively and run:

```bash
printf 'administrator ALL=(root) NOPASSWD: /volume1/@appstore/ContainerManager/usr/bin/docker\n' | sudo tee /etc/sudoers.d/docker-nopwd
sudo chmod 440 /etc/sudoers.d/docker-nopwd
```

### 1. Pull the image (first-time only)

Container Manager's GUI does not support third-party registries like ghcr.io — pull via SSH instead:

```bash
ssh nas "sudo /volume1/@appstore/ContainerManager/usr/bin/docker pull ghcr.io/chrismancini/between-us:latest"
```

### 2. Create the container (first-time only)

1. Go to **Container** in the left sidebar
2. Click **Create** and select the `ghcr.io/chrismancini/between-us:latest` image
3. Configure the following:
   - **Container name:** `between-us`
   - **Port:** Map local port `3000` to container port `3000`
   - **Environment variables:**
     - `MONGODB_URI` = `mongodb://<nas-ip>:27017/between-us` (must start with `mongodb://` — no quotes, no extra characters)
     - `AUTH_SECRET` = a generated secret (run `openssl rand -base64 32`)
     - *(Optional)* OAuth provider credentials — see [Environment Variables](#environment-variables) for the full list of supported providers
   - **Restart policy:** `always` (survives NAS restarts)
4. Click **Apply** / **Done**

### 3. Verify

Open `http://<nas-ip>:3000` in a browser. You should see the login page.

### Troubleshooting

- **`UntrustedHost` errors in logs:** Auth.js may reject requests from unrecognized hostnames (e.g., `data.local`). The app sets `trustHost: true` by default, which is appropriate for a self-hosted LAN deployment. If you still see this error, add the environment variable `AUTH_TRUST_HOST=true` to the container.
- **`MongoParseError: Invalid scheme`:** The `MONGODB_URI` value is malformed. It must start with `mongodb://` — verify there are no extra quotes, spaces, or missing scheme prefix in the container's environment variables.
- **`Cannot read properties of undefined (reading 'role')`:** This is a cascade from auth or database connection failures. Fix the underlying `UntrustedHost` or `MongoParseError` issue first.

### Notes

- **MongoDB connectivity:** If MongoDB runs as a container on the same NAS, use the NAS LAN IP or a shared Docker network — not `localhost` (which inside the container refers to the container itself). If both containers share a Docker network, you can use the MongoDB container name as the hostname.
- **Docker network:** Create a shared network in Container Manager under **Network** and assign both the MongoDB and Between Us containers to it.

### Updating the Application

```bash
node deploy.mjs
```

This pulls the latest image from `ghcr.io` directly on the NAS and restarts the container — no tar files, no GUI required.
