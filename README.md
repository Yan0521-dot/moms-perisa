# Mom's Perisa — Phase 1 website

Mom's Perisa is a React + Vite home-cooked food marketplace. This version keeps the existing visual design and uses Supabase for real accounts and shared data. It intentionally does not show sample dishes or pretend that local browser data is real marketplace data.

## Included in this update

- The existing light/dark theme and English, Bahasa Melayu, Simplified Chinese, and Tamil language selector.
- A clickable roadmap for Phase 1 through Phase 4.
- Public menus populated only from approved, available dishes in Supabase. Empty menus stay empty; there are no fake sample listings.
- Customer and cook sign-up/sign-in through Supabase Auth. Public registration cannot create an admin account.
- Private cook SSM documents and kitchen evidence, visible to the cook and admin through signed file links and previews.
- Separate admin queues for cook applications, menu submissions, and recurring kitchen-hygiene submissions.
- Menu photo upload and admin approval before a dish is public. Editing a dish sends it back for review.
- Order workflow: pending → accepted → cooking → ready → handed over → customer receipt confirmation.
- Database-generated notifications for new orders, order-status changes, cook verification changes, menu edits, and receipt issues. The UI polls for updates while signed in.
- Customer reviews after receipt is confirmed, with public review cards linked to the cook.
- Three-day kitchen-hygiene status: yellow while a recent submission is being reviewed, green after approval within three days, and red when no approved update is recent or a review has been overdue for more than three days.
- Cook dashboard totals for order count, estimated order value handed over, and average rating.

## 1. Run locally

```bash
npm install
cp .env.example .env.local
```

Fill `.env.local` with the Supabase project URL and public anon/publishable key:

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT-ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

Never place the Supabase `service_role` or secret key in a frontend environment variable.

Then start Vite:

```bash
npm run dev
```

## 2. Set up Supabase

1. Open the Supabase SQL Editor.
2. Run `supabase/schema.sql` first.
3. Run `supabase/phase1_workflows.sql` second.
4. In Supabase Storage, confirm the `seller-private-documents` bucket is private and `food-images` is public. The SQL creates/configures these buckets and their policies in the base schema.
5. Configure Supabase Auth email confirmation and allowed redirect URLs for local development and the production site.
6. Create your first admin account through normal sign-up as a customer, then use the SQL Editor as project owner to promote the trusted account:

```sql
update public.profiles
set role = 'admin'
where id = 'PASTE-THE-TRUSTED-USER-UUID-HERE';
```

Do not expose admin role selection on public sign-up. The UUID should be copied from the trusted account in Supabase Auth.

## Important operational notes

- SSM registration alone is not a complete food-safety certification. Follow applicable Malaysian food-handler, premises, local-authority, and other legal requirements.
- SSM files and kitchen hygiene evidence are private. Do not make the `seller-private-documents` bucket public.
- Version 1 payments are arranged directly between the customer and cook. The cook dashboard reports estimated order value, not verified cash received or accounting profit.
- Browser notifications are database-backed and refresh while the user is signed in. Email/SMS/push notifications require a separate provider and server-side integration.
- The three-day hygiene status is a display and review workflow; it does not independently verify kitchen safety.

## 3. Build

```bash
npm run build
```

The production output is `dist/`.
