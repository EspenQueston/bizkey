-- Local dev seed data.
-- Plans, RLS policies, and other core data are already seeded by the migrations
-- in supabase/migrations/. Add local-only convenience data here if needed.

-- Local-only admin account for development / testing the ERP panel.
-- Email:    admin@bizkey.local
-- Password: BizKey2026!
-- Bootstraps directly into auth.users + auth.identities (mirrors what
-- Supabase's own Auth Admin API creates) so the on_auth_user_created trigger
-- fires and creates the matching profiles row. approved_admins is inserted
-- first so the trigger sees it and sets is_admin = true automatically.
do $$
declare
  v_user_id uuid := gen_random_uuid();
begin
  insert into public.approved_admins (email, granted_by)
  values ('admin@bizkey.local', 'seed')
  on conflict (email) do nothing;

  if not exists (select 1 from auth.users where email = 'admin@bizkey.local') then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, confirmation_token, recovery_token,
      email_change_token_new, email_change,
      raw_app_meta_data, raw_user_meta_data,
      is_super_admin, created_at, updated_at, is_sso_user, is_anonymous
    ) values (
      '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
      'admin@bizkey.local', crypt('BizKey2026!', gen_salt('bf')),
      now(), '', '', '', '',
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"name":"Admin BizKey"}'::jsonb,
      false, now(), now(), false, false
    );

    insert into auth.identities (
      id, provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_user_id::text, v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', 'admin@bizkey.local'),
      'email', now(), now(), now()
    );
  end if;
end $$;
