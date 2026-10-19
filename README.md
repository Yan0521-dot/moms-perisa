# Mom's Perisa — Version 1

Responsive React + Vite website for a home-cooked food pre-order marketplace. Version 1 includes:

- English, Bahasa Melayu, Simplified Chinese, and Tamil interface options.
- Light and dark themes.
- Customer signup/login, browsing approved menus, and pre-order requests.
- Cook signup/login, SSM and kitchen-hygiene evidence submission, admin review feedback, and dish listing submissions.
- Admin review of SSM and kitchen hygiene as separate checks, with approve/request-changes actions.
- Order status workflow. No online payment is collected in V1; payment is arranged directly between the customer and cook.
- Supabase Auth, Postgres, and private Storage integration.

## 1. Try the interface locally without Supabase

Requires Node.js 18+ and npm.

```bash
npm install
npm run dev
```

Open the Vite URL (usually `http://localhost:5173`). Without `.env.local`, the app runs in **local preview mode** with sample food and demo role buttons. Preview data is saved only in this browser and is not shared or secure; **do not upload real SSM documents or real personal information in preview mode**.

## 2. Connect Supabase for real accounts/data

1. Create a Supabase project.
2. In Supabase **SQL Editor**, run `supabase/schema.sql`.
3. Copy `.env.example` to `.env.local` in the project root.
4. Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the publishable/anon key from Project Settings → API).
5. In Supabase Auth settings, configure your local redirect URL, for example `http://localhost:5173/**`, and your production Vercel URL later. For a simpler test, email confirmation may be temporarily disabled in Supabase Auth, but turn on suitable confirmation for production.
6. Restart Vite after changing environment variables:

```bash
npm run dev
```

Do **not** use a Supabase `service_role` key in this frontend project.

### Create an admin

1. Register a normal account through the app.
2. In Supabase SQL Editor, run the admin bootstrap statement at the bottom of `supabase/schema.sql`, replacing `YOUR-ADMIN-EMAIL` with your exact account email.
3. Sign out and sign back in to refresh the account role.

Admin role is deliberately not available in public registration.

## 3. Test the production build locally

```bash
npm run build
npm run preview
```

## Important V1 limitations

- There is no online payment, escrow, automatic payout, or integrated rider service.
- Customers submit pre-order requests; cooks accept or reject them.
- SSM registration and platform checks do not replace applicable Malaysian food handling, food premises, local authority, or other compliance requirements.
- Supabase Storage is configured for private seller evidence. Before public launch, verify every RLS policy against real test accounts, add a privacy notice and terms, and test the complete approval/order workflow.
- Menu photos currently use an optional image URL; a future iteration can add a dedicated image uploader.
- Translation dictionaries cover the primary interface and common workflows; review all wording with fluent speakers before public launch.

## Deployment

Deploy the Vite app to Vercel after the local build and Supabase tests pass. Add the same two `VITE_SUPABASE_*` environment variables in Vercel Project Settings → Environment Variables, then redeploy. Never add secrets to Git.
