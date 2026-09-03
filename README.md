# Partner Schools Hub

A private collaboration portal for the Partner Schools leadership team. The production workspace starts with Jan Baloglu as the sole super administrator, the approved school-area folders, and no illustrative documents, events, meetings, tasks, links, notifications, or audit entries.

## Local preview

```bash
npm ci
npm run dev
```

Development mode uses an isolated, empty local preview for Jan Baloglu. It stores only records you create in the current browser. Legacy Company Hub demo storage is removed automatically. Production builds explicitly disable this preview and require Supabase authentication.

The local preview now opens on `/login`. Its credentials are stored only in the git-ignored `.env.development.local`; never copy the preview password into a committed file or a `VITE_` variable in Vercel.

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
   supabase functions deploy file-access
   supabase functions deploy dispatch-notifications --no-verify-jwt
   ```

3. In Supabase Dashboard → Authentication → Users, create and auto-confirm `mcanbaloglu@enishi.ac.jp` with the password supplied by the owner. Add `full_name: Jan Baloglu` to user metadata. Do not put that password in Git or Vercel.
4. Copy `.env.example` to `.env.local` for local connected development. In Vercel, configure only:

   ```text
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
   VITE_APP_TIMEZONE=Asia/Tokyo
   VITE_ENABLE_LOCAL_PREVIEW=false
   ```

5. Configure Edge Function secrets; never expose these as Vite variables:

   ```bash
   supabase secrets set SUPABASE_SECRET_KEY=... RESEND_API_KEY=... DISPATCH_SECRET=... APP_URL=https://YOUR_DOMAIN EMAIL_FROM='Partner Schools Hub <notifications@YOUR_DOMAIN>'
   ```

6. Configure Resend as Supabase custom SMTP. Allow only the production `/accept-invite` and `/reset-password` redirect URLs.
7. Sign in at the deployed `/login` page as `mcanbaloglu@enishi.ac.jp`. The first successful sign-in securely creates the single Partner Schools Hub workspace, assigns Jan the protected `owner` role displayed as **Super Admin**, and creates the standard folders. All subsequent administrators must be invited from Team access.
8. Schedule `dispatch-notifications` through Supabase Cron using an `x-dispatch-secret` stored in Vault. The database reminder job runs daily at 08:00 Asia/Tokyo.
9. Import the repository into Vercel, set the production environment variables, and deploy. `vercel.json` supplies SPA rewrites and baseline security headers.

For a showcase, invite each reviewer from Team access so uploads and actions are attributed correctly. If reviewers must share the owner account temporarily, rotate its password immediately after the showcase.

## Live release tests

After building with the connected Supabase variables, set:

```text
E2E_LIVE_SUPABASE=1
E2E_OWNER_EMAIL=<Jan's real email>
E2E_OWNER_PASSWORD=<test password>
E2E_ADMIN_EMAIL=<second test administrator>
E2E_ADMIN_PASSWORD=<test password>
```

A fresh `E2E_INVITE_URL` and `E2E_INVITED_PASSWORD` enable the invitation-acceptance journey. Run `supabase test db` for the pgTAP RLS suite and `npm run test:e2e` for browser journeys.

## Architecture and security

- React, Vite, TypeScript, React Router, TanStack Query, React Hook Form, and Zod.
- Supabase Auth, Postgres, RLS, private Storage, Realtime, Edge Functions, and Cron.
- Private 50 MB document storage with MIME allowlists, immutable versions, short-lived signed access, and file-access auditing.
- Owner-only membership and audit access with final-owner database protection.
- Self-service name, organisation, job title, and phone details; invitees must be assigned an organisation by the super administrator.
- Administrator-managed folders with recoverable 30-day soft deletion; files remain visible from All files if their folder is archived.
- Versioned local preview storage, route-level lazy loading, keyboard-visible focus, reduced motion support, and fixed mobile navigation.
- Generated full-text indexes, indexed workspace policy checks, soft deletion, and 30-day trash retention.

## Release checklist

- Confirm the production build opens `/login` when Supabase is absent; it must never enter local preview mode.
- Confirm public signup is disabled, SMTP is active, and only trusted redirect URLs are configured.
- Verify the Tokyo region before the first migration.
- Run `npm ci`, `npm run check`, `npm audit`, `supabase test db`, and the live browser suite.
- Confirm Vercel preview and production environments use separate Supabase projects.
- Configure backups, provider alerts, Cron, and secret rotation.
- Confirm production contains only Jan Baloglu and the standard folders before inviting other administrators.
