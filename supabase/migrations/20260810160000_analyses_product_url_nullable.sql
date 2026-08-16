-- Allow analyses that did not come from a product URL.
--
-- Image-based analysis (upload a photo instead of pasting a link) has no
-- source URL by definition, so the insert set product_url = null and hit the
-- NOT NULL constraint — the AI work completed and was then thrown away with a
-- 500. Fabricating a placeholder URL would be worse: it would store data that
-- looks like a real link and break every "voir le produit" action.
--
-- The column becomes nullable and callers must handle the absence explicitly.

alter table public.analyses
  alter column product_url drop not null;

comment on column public.analyses.product_url is
  'Source product URL. NULL for analyses started from an uploaded image, which have no originating link.';
