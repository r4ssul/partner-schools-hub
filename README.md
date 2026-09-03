# Partner Schools Hub

A private collaboration portal for partner-school leaders, hosted on GitHub Pages with Supabase Auth/Postgres/Realtime and private Cloudflare R2 storage. Rassul Abzhapparov is the Owner, Jan Baloglu is the Super Admin, and invited members are Admins. No illustrative content is seeded in production.

## Local preview

```bash
npm ci
npm run dev
```

Development mode uses an isolated, empty local preview for Jan Baloglu. It stores only records you create in the current browser. Legacy Company Hub demo storage is removed automatically. Production builds explicitly disable this preview and require Supabase authentication.

The local preview now opens on `/login`. Its credentials are stored only in the git-ignored `.env.development.local`; never copy the preview password into a committed file.

Quality checks:

```bash
npm run check
npm run test:e2e
npm audit
```

The browser suite builds in test mode, enables the isolated preview, and runs at 1536×960 and 390×844. Live Supabase journeys are gated behind the credentials documented below.

## Production setup

1. Create a hosted Supabase project in Tokyo (`ap-northeast-1`). In Authentication settings, disable public registration.
2. Link the project, apply the schema, and deploy the trusted functions:

   ```bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   supabase functions deploy manage-members
   supabase functions deploy dispatch-notifications --no-verify-jwt
   ```

3. For a new installation, create and auto-confirm the initial Owner account `rassul.abzhapparov@enishi.ac.jp` in Supabase Dashboard → Authentication → Users. Set `full_name: Rassul Abzhapparov`. Set credentials privately; never put passwords in Git. The existing production accounts are already provisioned.
4. Copy `.env.example` to `.env.local` for local connected development. In GitHub Actions, configure:

   ```text
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
   VITE_R2_FILE_API_URL=https://partner-schools-hub-files.YOUR_SUBDOMAIN.workers.dev
   VITE_APP_TIMEZONE=Asia/Tokyo
   VITE_ENABLE_LOCAL_PREVIEW=false
   ```

5. Configure Edge Function secrets; never expose these as Vite variables:

   ```bash
   supabase secrets set SUPABASE_SECRET_KEY=... RESEND_API_KEY=... DISPATCH_SECRET=... APP_URL=https://r4ssul.github.io/partner-schools-hub EMAIL_FROM='Partner Schools Hub <notifications@YOUR_DOMAIN>'
   ```

6. Configure Resend as Supabase custom SMTP. Allow only the production `/accept-invite` and `/reset-password` redirect URLs.
7. On a fresh installation, sign in as Rassul to create the single workspace and standard folders. Invite Jan through Team access, then assign his `workspace_members.role` to `super_admin` through the trusted Supabase dashboard. All other invitees receive `admin`. Migration 202609040009 transfers the existing workspace only when both named accounts are already present.
8. Schedule `dispatch-notifications` through Supabase Cron using an `x-dispatch-secret` stored in Vault. The database reminder job runs daily at 08:00 Asia/Tokyo.
9. Authenticate Wrangler, create the private R2 bucket, configure the Worker secrets, and deploy the file API:

   ```bash
   npx wrangler login
   npx wrangler r2 bucket create partner-schools-hub-files
   npx wrangler secret put SUPABASE_URL --config cloudflare/r2-file-api/wrangler.jsonc
   npx wrangler secret put SUPABASE_PUBLISHABLE_KEY --config cloudflare/r2-file-api/wrangler.jsonc
   npm run deploy:file-api
   ```

10. Add the Supabase URL, publishable key, and deployed Worker URL as GitHub Actions secrets. Push `main`; GitHub Pages automatically switches from browser-local showcase mode to the shared Supabase and R2 services.

For a showcase, invite each reviewer from Team access so uploads and actions are attributed correctly. If reviewers must share the owner account temporarily, rotate its password immediately after the showcase.

## Live release tests

After building with the connected Supabase variables, set:

```text
E2E_LIVE_SUPABASE=1
E2E_OWNER_EMAIL=<Rassul's real email>
E2E_OWNER_PASSWORD=<test password>
E2E_ADMIN_EMAIL=<second test administrator>
E2E_ADMIN_PASSWORD=<test password>
```

A fresh `E2E_INVITE_URL` and `E2E_INVITED_PASSWORD` enable the invitation-acceptance journey. Run `supabase test db` for the pgTAP RLS suite and `npm run test:e2e` for browser journeys.

## Architecture and security

- React, Vite, TypeScript, React Router, TanStack Query, React Hook Form, and Zod.
- Supabase Auth, Postgres, RLS, Realtime, Edge Functions, and Cron.
- Private Cloudflare R2 document storage behind an authenticated Worker, with a 50 MB limit, MIME allowlist, immutable versions, membership checks, and file-access auditing.
- Owner and Super Admin manage membership, workspace settings, and audit review. Only the Owner can clear activity/member logs. Both leadership accounts are protected from in-app deactivation, and the database protects the final Owner.
- Self-service name, organisation, job title, and phone details; invitees must be assigned an organisation by the super administrator.
- Administrator-managed folders with recoverable 30-day soft deletion; files remain visible from All files if their folder is archived.
- Versioned local preview storage, route-level lazy loading, keyboard-visible focus, reduced motion support, and fixed mobile navigation.
- Generated full-text indexes, indexed workspace policy checks, soft deletion, and 30-day trash retention.
- Persistent shared team chat with RLS-protected history, authenticated sender identity, idempotent sends, a 2,000-character limit, a 30-message/minute server limit, unread indicators, and Realtime updates. The latest 100 messages load first, with older-history pagination. Direct/private messages and chat attachments are not included.
- Creation dialogs support drag-and-drop upload, nested folder choices, duplicate-folder checks, checkbox attendees/linked files, Tokyo-time validation, and atomic database creation of items and their relations.

## Hosting scope

GitHub Pages is the only frontend deployment target. The obsolete local Sites manifest was removed; Supabase and Cloudflare R2 remain the sources of truth. The remote legacy Sites publication must be deleted through the Sites interface because the connector has no delete operation.

The production workflow always disables local preview. Missing Supabase configuration must never open a demo workspace publicly.

## Permission and chat checks

Run the transaction-only database suite with `supabase test db` locally, or `supabase db query --linked --file supabase/tests/roles_chat_creation.test.sql` against a linked project. It creates its own uniquely identified fixtures and rolls back every row. It checks all three roles, log-clearing boundaries, non-member/deactivated access, sender identity, retry deduplication, read-state privacy, and cross-workspace creation links.

Branded authentication email requires custom SMTP. The default Supabase email provider has not been replaced by this release.

## Release checklist

- Confirm the production build opens `/login` when Supabase is absent; it must never enter local preview mode.
- Confirm public signup is disabled, SMTP is active, and only trusted redirect URLs are configured.
- Verify the Tokyo region before the first migration.
- Run `npm ci`, `npm run check`, `npm audit`, `supabase test db`, and the live browser suite.
- Confirm GitHub Pages has the Supabase and R2 endpoint secrets and no longer builds in showcase mode.
- Configure backups, provider alerts, Cron, and secret rotation.
- Confirm Rassul is Owner, Jan is Super Admin, and all other members are Admins. Preserve real production content; do not reset it when deploying.
