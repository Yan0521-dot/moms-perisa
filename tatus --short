[1mdiff --git a/README.md b/README.md[m
[1mindex 54b8f56..116f070 100644[m
[1m--- a/README.md[m
[1m+++ b/README.md[m
[36m@@ -1,65 +1,114 @@[m
[31m-# Mom's Perisa — Version 1[m
[32m+[m[32m# Mom's Perisa — Phase 1 website[m
 [m
[31m-Responsive React + Vite website for a home-cooked food pre-order marketplace. Version 1 includes:[m
[32m+[m[32mMom's Perisa is a React + Vite home-cooked food marketplace. This version keeps the existing visual design and uses Supabase for real accounts and shared data. It intentionally does not show sample dishes or pretend that local browser data is real marketplace data.[m
 [m
[31m-- English, Bahasa Melayu, Simplified Chinese, and Tamil interface options.[m
[31m-- Light and dark themes.[m
[31m-- Customer signup/login, browsing approved menus, and pre-order requests.[m
[31m-- Cook signup/login, SSM and kitchen-hygiene evidence submission, admin review feedback, and dish listing submissions.[m
[31m-- Admin review of SSM and kitchen hygiene as separate checks, with approve/request-changes actions.[m
[31m-- Order status workflow. No online payment is collected in V1; payment is arranged directly between the customer and cook.[m
[31m-- Supabase Auth, Postgres, and private Storage integration.[m
[32m+[m[32m## Included in this update[m
 [m
[31m-## 1. Try the interface locally without Supabase[m
[32m+[m[32m- The existing light/dark theme and English, Bahasa Melayu, Simplified Chinese, and Tamil language selector.[m
[32m+[m[32m- A clickable roadmap for Phase 1 through Phase 4.[m
[32m+[m[32m- Public menus populated only from approved, available dishes in Supabase. Empty menus stay empty; there are no fake sample listings.[m
[32m+[m[32m- Customer and cook sign-up/sign-in through Supabase Auth. Public registration cannot create an admin account.[m
[32m+[m[32m- Private cook SSM documents and kitchen evidence, visible to the cook and admin through signed file links and previews.[m
[32m+[m[32m- Separate admin queues for cook applications, menu submissions, and recurring kitchen-hygiene submissions.[m
[32m+[m[32m- Menu photo upload and admin approval before a dish is public. Editing a dish sends it back for review.[m
[32m+[m[32m- Order workflow: pending → accepted → cooking → ready → handed over → customer receipt confirmation.[m
[32m+[m[32m- Database-generated notifications for new orders, order-status changes, cook verification changes, menu edits, and receipt issues. The UI polls for updates while signed in.[m
[32m+[m[32m- Customer reviews after receipt is confirmed, with public review cards linked to the cook.[m
[32m+[m[32m- Three-day kitchen-hygiene status: yellow while a recent submission is being reviewed, green after approval within three days, and red when no approved update is recent or a review has been overdue for more than three days.[m
[32m+[m[32m- Cook dashboard totals for order count, estimated order value handed over, and average rating.[m
 [m
[31m-Requires Node.js 18+ and npm.[m
[32m+[m[32m## 1. Run locally[m
 [m
 ```bash[m
 npm install[m
[31m-npm run dev[m
[32m+[m[32mcp .env.example .env.local[m
 ```[m
 [m
[31m-Open the Vite URL (usually `http://localhost:5173`). Without `.env.local`, the app runs in **local preview mode** with sample food and demo role buttons. Preview data is saved only in this browser and is not shared or secure; **do not upload real SSM documents or real personal information in preview mode**.[m
[32m+[m[32mFill `.env.local` with the Supabase project URL and public anon/publishable key:[m
[32m+[m
[32m+[m[32m```env[m
[32m+[m[32mVITE_SUPABASE_URL=https://YOUR-PROJECT-ID.supabase.co[m
[32m+[m[32mVITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY[m
[32m+[m[32m```[m
 [m
[31m-## 2. Connect Supabase for real accounts/data[m
[32m+[m[32mNever place the Supabase `service_role` or secret key in a frontend environment variable.[m
 [m
[31m-1. Create a Supabase project.[m
[31m-2. In Supabase **SQL Editor**, run `supabase/schema.sql`.[m
[31m-3. Copy `.env.example` to `.env.local` in the project root.[m
[31m-4. Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the publishable/anon key from Project Settings → API).[m
[31m-5. In Supabase Auth settings, configure your local redirect URL, for example `http://localhost:5173/**`, and your production Vercel URL later. For a simpler test, email confirmation may be temporarily disabled in Supabase Auth, but turn on suitable confirmation for production.[m
[31m-6. Restart Vite after changing environment variables:[m
[32m+[m[32mThen start Vite:[m
 [m
 ```bash[m
 npm run dev[m
 ```[m
 [m
[31m-Do **not** use a Supabase `service_role` key in this frontend project.[m
[32m+[m[32m## 2. Set up Supabase[m
[32m+[m
[32m+[m[32m1. Open the Supabase SQL Editor.[m
[32m+[m[32m2. Run `supabase/schema.sql` first.[m
[32m+[m[32m3. Run `supabase/phase1_workflows.sql` second.[m
[32m+[m[32m4. In Supabase Storage, confirm the `seller-private-documents` bucket is private and `food-images` is public. The SQL creates/configures these buckets and their policies in the base schema.[m
[32m+[m[32m5. Configure Supabase Auth email confirmation and allowed redirect URLs for local development and the production site.[m
[32m+[m[32m6. Create your first admin account through normal sign-up as a customer, then use the SQL Editor as project owner to promote the trusted account:[m
 [m
[31m-### Create an admin[m
[32m+[m[32m```sql[m
[32m+[m[32mupdate public.profiles[m
[32m+[m[32mset role = 'admin'[m
[32m+[m[32mwhere id = 'PASTE-THE-TRUSTED-USER-UUID-HERE';[m
[32m+[m[32m```[m
[32m+[m
[32m+[m[32mDo not expose admin role selection on public sign-up. The UUID should be copied from the trusted account in Supabase Auth.[m
 [m
[31m-1. Register a normal account through the app.[m
[31m-2. In Supabase SQL Editor, run the admin bootstrap statement at the bottom of `supabase/schema.sql`, replacing `YOUR-ADMIN-EMAIL` with your exact account email.[m
[31m-3. Sign out and sign back in to refresh the account role.[m
[32m+[m[32m## Important operational notes[m
 [m
[31m-Admin role is deliberately not available in public registration.[m
[32m+[m[32m- SSM registration alone is not a complete food-safety certification. Follow applicable Malaysian food-handler, premises, local-authority, and other legal requirements.[m
[32m+[m[32m- SSM files and kitchen hygiene evidence are private. Do not make the `seller-private-documents` bucket public.[m
[32m+[m[32m- Version 1 payments are arranged directly between the customer and cook. The cook dashboard reports estimated order value, not verified cash received or accounting profit.[m
[32m+[m[32m- Browser notifications are database-backed and refresh while the user is signed in. Email/SMS/push notifications require a separate provider and server-side integration.[m
[32m+[m[32m- The three-day hygiene status is a display and review workflow; it does not independently verify kitchen safety.[m
 [m
[31m-## 3. Test the production build locally[m
[32m+[m[32m## 3. Build[m
 [m
 ```bash[m
 npm run build[m
[31m-npm run preview[m
 ```[m
 [m
[31m-## Important V1 limitations[m
[32m+[m[32mThe production output is `dist/`.[m
[32m+[m
[32m+[m[32m## Troubleshooting: the Pre-order button does nothing[m
[32m+[m
[32m+[m[32mVersion 1 creates a pre-order through one database function, `create_preorder()`. If that[m
[32m+[m[32mfunction, the `orders`/`order_items` tables, or the `profiles` row for the signed-in account[m
[32m+[m[32mis missing, nothing is written to Supabase and the customer and cook dashboards stay empty.[m
[32m+[m
[32m+[m[32mThe app now tells you which of these happened instead of failing silently:[m
[32m+[m
[32m+[m[32m- The order sheet shows a red **"Pre-order not saved"** box with the exact database message.[m
[32m+[m[32m- A home-cook or administrator account sees "This account cannot place a pre-order" when it[m
[32m+[m[32m  clicks Pre-order. Cook appointments receive orders; only customer accounts can place them.[m
[32m+[m[32m- An account without a `profiles` row gets a banner explaining that `fix_preorders.sql` must[m
[32m+[m[32m  be run.[m
[32m+[m
[32m+[m[32mTo repair an existing Supabase project:[m
[32m+[m
[32m+[m[32m1. Run `supabase/check_preorders.sql` and read the report. Any row that is not `ok`, and any[m
[32m+[m[32m   `accounts_without_profile` above `0`, is part of the problem.[m
[32m+[m[32m2. Run `supabase/fix_preorders.sql`, then reload the report from step 1.[m
[32m+[m[32m3. Sign out of the website and sign in again, then place a test pre-order.[m
[32m+[m[32m4. Check **Table Editor → orders** in Supabase. A successful order appears there immediately,[m
[32m+[m[32m   with its `order_items` row, and the cook receives a "New pre-order" notification.[m
[32m+[m
[32m+[m[32m`fix_preorders.sql` is safe to run repeatedly and never deletes data. It creates missing[m
[32m+[m[32mprofile rows for existing auth users, installs `create_preorder()` / `ensure_my_profile()`,[m
[32m+[m[32mrestores the order triggers and row-level-security policies, and adds table grants.[m
[32m+[m
[32m+[m[32mCommon causes it repairs:[m
[32m+[m
[32m+[m[32m| Symptom | Cause |[m
[32m+[m[32m| --- | --- |[m
[32m+[m[32m| Clicking Pre-order does nothing at all | The signed-in account has no `profiles` row, so the app cannot treat it as a customer. |[m
[32m+[m[32m| "Pre-order not saved: Could not find the function public.create_preorder" | `schema.sql` was never run, or was only partly run, against this project. |[m
[32m+[m[32m| Order saved but the customer and cook lists are empty | The `reviews` or `notifications` table that the order query joins is missing, so the query fails. |[m
[32m+[m[32m| Cook never sees the order | The cook is signed in with a different account than the dish's `cook_id`, or the `notifications` table/policy is missing. |[m
[32m+[m[32m| "Customer account required" | The account was created as a cook. Use a customer account, or change the role in SQL. |[m
 [m
[31m-- There is no online payment, escrow, automatic payout, or integrated rider service.[m
[31m-- Customers submit pre-order requests; cooks accept or reject them.[m
[31m-- SSM registration and platform checks do not replace applicable Malaysian food handling, food premises, local authority, or other compliance requirements.[m
[31m-- Supabase Storage is configured for private seller evidence. Before public launch, verify every RLS policy against real test accounts, add a privacy notice and terms, and test the complete approval/order workflow.[m
[31m-- Menu photos currently use an optional image URL; a future iteration can add a dedicated image uploader.[m
[31m-- Translation dictionaries cover the primary interface and common workflows; review all wording with fluent speakers before public launch.[m
 [m
[31m-## Deployment[m
 [m
[31m-Deploy the Vite app to Vercel after the local build and Supabase tests pass. Add the same two `VITE_SUPABASE_*` environment variables in Vercel Project Settings → Environment Variables, then redeploy. Never add secrets to Git.[m
[32m+[m[32mAfter the project is configured locally and the SQL is applied, commit and push the updated files to the existing `main` branch. If Cloudflare is already connected to this GitHub repository with a working Vite build configuration, it should start a new deployment automatically after the push. The Cloudflare Worker workflow and the static Pages workflow have different build/deploy settings, so confirm which workflow the connected project uses before changing its deployment commands.[m
