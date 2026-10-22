-- RAGHAV COMPUTER INSTITUTIONS - secure admin/student setup
-- Review before running. Run this whole file in Supabase SQL Editor.
-- Do NOT put a service_role key in browser files.

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.certificates enable row level security;
alter table public.profiles add column if not exists status text not null default 'studying';
alter table public.courses add column if not exists description text;
alter table public.courses add column if not exists fee numeric(10,2);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;

create or replace function public.is_institute_admin()
returns boolean language sql stable security definer set search_path = public, auth
as $$ select exists(select 1 from public.admin_users a where a.user_id = auth.uid()); $$;
revoke all on function public.is_institute_admin() from public;
grant execute on function public.is_institute_admin() to authenticated;

-- Remove existing policies from these three tables so older self-registration policies
-- cannot accidentally leave public admission/write access enabled.
do $$ declare p record; begin
  for p in select schemaname, tablename, policyname from pg_policies
    where schemaname='public' and tablename in ('profiles','courses','certificates','admin_users')
  loop execute format('drop policy if exists %I on %I.%I',p.policyname,p.schemaname,p.tablename); end loop;
end $$;

create policy "admin_users_select_own" on public.admin_users for select to authenticated using (user_id=auth.uid());
create policy "courses_public_read" on public.courses for select to anon, authenticated using (true);
create policy "courses_admin_insert" on public.courses for insert to authenticated with check (public.is_institute_admin());
create policy "courses_admin_update" on public.courses for update to authenticated using (public.is_institute_admin()) with check (public.is_institute_admin());
create policy "courses_admin_delete" on public.courses for delete to authenticated using (public.is_institute_admin());

create policy "profiles_student_or_admin_read" on public.profiles for select to authenticated using (id=auth.uid() or public.is_institute_admin());
create policy "profiles_admin_insert" on public.profiles for insert to authenticated with check (public.is_institute_admin());
create policy "profiles_admin_update" on public.profiles for update to authenticated using (public.is_institute_admin()) with check (public.is_institute_admin());
create policy "profiles_admin_delete" on public.profiles for delete to authenticated using (public.is_institute_admin());

create policy "certificates_student_or_admin_read" on public.certificates for select to authenticated using (student_id=auth.uid() or public.is_institute_admin());
create policy "certificates_admin_insert" on public.certificates for insert to authenticated with check (public.is_institute_admin());
create policy "certificates_admin_update" on public.certificates for update to authenticated using (public.is_institute_admin()) with check (public.is_institute_admin());
create policy "certificates_admin_delete" on public.certificates for delete to authenticated using (public.is_institute_admin());

-- Public QR lookup returns only non-sensitive certificate details.
create or replace function public.verify_certificate(p_code text)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare r record;
begin
  select c.certificate_number,c.issue_date,c.grade,c.verification_code,
         p.full_name as student_name,p.student_id,coalesce(co.name,p.course,'Computer Course') as course_name
    into r
    from public.certificates c
    join public.profiles p on p.id=c.student_id
    left join public.courses co on co.id=c.course_id
   where c.verification_code::text=p_code or c.certificate_number=p_code
   limit 1;
  if not found then return jsonb_build_object('valid',false); end if;
  return jsonb_build_object('valid',true,'certificate',jsonb_build_object(
    'certificate_number',r.certificate_number,'issue_date',r.issue_date,'grade',r.grade,
    'student_name',r.student_name,'student_id',r.student_id,'course_name',r.course_name));
end; $$;
revoke all on function public.verify_certificate(text) from public;
grant execute on function public.verify_certificate(text) to anon, authenticated;

-- Student ID -> email lookup used by the existing student login page.
-- This function only returns the email for a matching Student ID, so keep student IDs non-public.
-- If your existing get_student_email function is already working, keep it; do not replace it here.

-- Admin can read student photos for certificate downloads. Existing student-owned photo policies may remain.
drop policy if exists "admin_read_student_photos" on storage.objects;
create policy "admin_read_student_photos" on storage.objects for select to authenticated
using (bucket_id='student-photos' and public.is_institute_admin());

-- After creating your own admin login in Supabase Authentication > Users, add its UUID below:
-- insert into public.admin_users(user_id) values ('PASTE-YOUR-ADMIN-AUTH-USER-UUID-HERE');
