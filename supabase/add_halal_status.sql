-- Mom's Perisa Phase 2: Kitchen halal status
-- Adds a separate halal status to existing cook profiles.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS halal_status text
NOT NULL DEFAULT 'not_halal'
CHECK (halal_status IN ('halal', 'not_halal'));

COMMENT ON COLUMN public.profiles.halal_status IS
'Cook-declared food status: halal or not_halal. This is not a halal certification claim.';
