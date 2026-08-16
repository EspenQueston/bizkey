-- Let admins read every analysis and usage log.
--
-- The admin "Analyses" page offers a switch between the admin's own history
-- and the whole platform's. Without these policies the "all users" view would
-- silently return only the admin's own rows — RLS filters instead of erroring,
-- so the page would look like it worked while showing incomplete data.
--
-- public.is_admin() is SECURITY DEFINER, which avoids the self-referencing
-- recursion that a direct subquery on profiles would cause here.

create policy "Admins can view all analyses"
  on public.analyses
  for select
  to authenticated
  using (public.is_admin());

create policy "Admins can view all usage logs"
  on public.usage_logs
  for select
  to authenticated
  using (public.is_admin());
