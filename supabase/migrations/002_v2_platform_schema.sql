-- English Little World V2 Schema Migration
-- Safe, additive, idempotent migration extending V1 without dropping data.

create extension if not exists pgcrypto;

-- 1. Extend parent_profiles
alter table public.parent_profiles
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists role text not null default 'parent' check (role in ('parent', 'editor', 'admin')),
  add column if not exists updated_at timestamptz not null default now();

-- Helper function for RLS role checks without policy recursion
create or replace function public.is_admin_or_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.parent_profiles p
    where p.id = auth.uid()
      and p.role in ('editor', 'admin')
  );
$$;

-- Prevent parents from escalating their own role via client insert or update
create or replace function public.guard_parent_role_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'authenticated' and new.role is distinct from 'parent' and not public.is_admin_or_editor() then
    raise exception 'Role cannot be elevated by user';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_parent_role_insert on public.parent_profiles;
create trigger trg_guard_parent_role_insert
  before insert on public.parent_profiles
  for each row execute function public.guard_parent_role_insert();

create or replace function public.guard_parent_role_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if auth.role() <> 'service_role' and not public.is_admin_or_editor() then
      raise exception 'Role cannot be changed by user';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_guard_parent_role_update on public.parent_profiles;
create trigger trg_guard_parent_role_update
  before update on public.parent_profiles
  for each row execute function public.guard_parent_role_update();

-- Auto-create parent_profiles and free subscription on auth.users signup
create or replace function public.handle_new_parent_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.parent_profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email, 'Phụ huynh'), '@', 1)),
    'parent'
  )
  on conflict (id) do update
    set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_elw on auth.users;
create trigger on_auth_user_created_elw
  after insert on auth.users
  for each row execute function public.handle_new_parent_user();

-- 2. Extend child_profiles
alter table public.child_profiles
  add column if not exists age_years smallint check (age_years between 2 and 14),
  add column if not exists avatar_emoji text not null default '🐣',
  add column if not exists started_at date not null default current_date,
  add column if not exists ai_enabled boolean not null default false,
  add column if not exists ai_daily_limit integer not null default 15 check (ai_daily_limit between 1 and 60),
  add column if not exists achievements jsonb not null default '[]'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

alter table public.child_profiles
  alter column learning_level set default 'L1';

create index if not exists idx_child_profiles_parent_id on public.child_profiles(parent_id);

-- 3. Courses & Units
create table if not exists public.courses (
  id text primary key check (id in ('L1', 'L2', 'L3', 'L4')),
  name text not null,
  age_label text not null,
  age_range text not null,
  description text not null,
  goal text not null,
  color text not null,
  emoji text not null,
  sort_order smallint not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.units (
  id text primary key,
  level_id text not null references public.courses(id) on delete cascade,
  unit_order smallint not null check (unit_order between 1 and 8),
  title text not null,
  subtitle text not null,
  theme_emoji text not null default '📘',
  target_lessons_count smallint not null default 10,
  created_at timestamptz not null default now(),
  unique(level_id, unit_order)
);

create index if not exists idx_units_level_order on public.units(level_id, unit_order);

-- 4. Extend lessons (CMS & 320-lesson architecture)
alter table public.lessons
  add column if not exists unit_id text references public.units(id) on delete set null,
  add column if not exists lesson_order smallint not null default 1,
  add column if not exists pedagogical_slot smallint check (pedagogical_slot between 1 and 10),
  add column if not exists lesson_type text not null default 'listen' check (lesson_type in ('listen', 'speak', 'play', 'story')),
  add column if not exists duration_minutes smallint not null default 6,
  add column if not exists access_tier text not null default 'free' check (access_tier in ('free', 'premium')),
  add column if not exists parent_tip text,
  add column if not exists media jsonb not null default '{}'::jsonb,
  add column if not exists updated_by uuid references public.parent_profiles(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_lessons_status_level on public.lessons(status, level_id);
create index if not exists idx_lessons_unit_order on public.lessons(unit_id, lesson_order);

-- 5. Extend lesson_progress & add lesson_attempts
alter table public.lesson_progress
  drop constraint if exists lesson_progress_status_check;

alter table public.lesson_progress
  add constraint lesson_progress_status_check
  check (status in ('not_started', 'started', 'completed'));

alter table public.lesson_progress
  add column if not exists current_step smallint not null default 0,
  add column if not exists score integer,
  add column if not exists time_spent_seconds integer not null default 0,
  add column if not exists last_accessed_at timestamptz not null default now();

create index if not exists idx_lesson_progress_child on public.lesson_progress(child_id, updated_at desc);

create table if not exists public.lesson_attempts (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  lesson_id text not null references public.lessons(id) on delete cascade,
  activity_kind text not null,
  score integer,
  max_score integer,
  duration_seconds integer not null default 0,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_lesson_attempts_child on public.lesson_attempts(child_id, created_at desc);

-- 6. Extend parent_consents
alter table public.parent_consents
  add column if not exists child_id uuid references public.child_profiles(id) on delete cascade,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_parent_consents_parent on public.parent_consents(parent_id, consent_type);

-- 7. AI Sessions & Pronunciation Records
create table if not exists public.ai_sessions (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.parent_profiles(id) on delete cascade,
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  lesson_id text,
  level_id text not null check (level_id in ('L1', 'L2', 'L3', 'L4')),
  mode text not null default 'buddy' check (mode in ('buddy', 'pronunciation')),
  turns_used integer not null default 0,
  safety_flagged boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ai_sessions_child_date on public.ai_sessions(child_id, created_at desc);

create table if not exists public.pronunciation_records (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.parent_profiles(id) on delete cascade,
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  lesson_id text,
  target_text text not null,
  recognized_text text,
  feedback_label text not null,
  feedback_en text not null,
  feedback_vi text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_pronunciation_records_child on public.pronunciation_records(child_id, created_at desc);

-- 8. Plans, Subscriptions, and MoMo Payments
create table if not exists public.plans (
  id text primary key,
  name text not null,
  tagline text not null,
  price_vnd integer not null check (price_vnd >= 0),
  billing_cycle text not null default 'monthly' check (billing_cycle in ('free', 'monthly', 'yearly')),
  max_children integer not null default 1,
  ai_daily_limit integer not null default 5,
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  sort_order smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.parent_profiles(id) on delete cascade,
  plan_id text not null references public.plans(id),
  status text not null default 'active' check (status in ('active', 'pending_payment', 'past_due', 'canceled', 'expired')),
  billing_mode text not null default 'manual' check (billing_mode in ('free', 'manual', 'momo_recurring_pending', 'momo_recurring_active')),
  auto_renew boolean not null default false,
  momo_recurring_capable boolean not null default false,
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_subscriptions_parent on public.subscriptions(parent_id, created_at desc);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.parent_profiles(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  plan_id text not null references public.plans(id),
  provider text not null default 'momo',
  order_id text not null unique,
  request_id text not null unique,
  momo_trans_id text,
  amount_vnd integer not null check (amount_vnd >= 0),
  currency text not null default 'VND',
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'canceled', 'expired')),
  result_code integer,
  message text,
  raw_ipn jsonb,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payments_parent on public.payments(parent_id, created_at desc);
create index if not exists idx_payments_order_id on public.payments(order_id);

-- 9. Enable Row Level Security (RLS) across all V2 tables
alter table public.courses enable row level security;
alter table public.units enable row level security;
alter table public.lesson_attempts enable row level security;
alter table public.ai_sessions enable row level security;
alter table public.pronunciation_records enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;

-- Public read policies for catalog & active plans
drop policy if exists "public read courses" on public.courses;
create policy "public read courses" on public.courses for select using (true);

drop policy if exists "public read units" on public.units;
create policy "public read units" on public.units for select using (true);

drop policy if exists "public read active plans" on public.plans;
create policy "public read active plans" on public.plans for select using (is_active = true or public.is_admin_or_editor());

-- Editorial / CMS policies
drop policy if exists "editors manage courses" on public.courses;
create policy "editors manage courses" on public.courses for all using (public.is_admin_or_editor()) with check (public.is_admin_or_editor());

drop policy if exists "editors manage units" on public.units;
create policy "editors manage units" on public.units for all using (public.is_admin_or_editor()) with check (public.is_admin_or_editor());

drop policy if exists "editors read all lessons" on public.lessons;
create policy "editors read all lessons" on public.lessons for select using (status = 'published' or public.is_admin_or_editor());

drop policy if exists "editors manage lessons" on public.lessons;
create policy "editors manage lessons" on public.lessons for all using (public.is_admin_or_editor()) with check (public.is_admin_or_editor());

drop policy if exists "admins manage plans" on public.plans;
create policy "admins manage plans" on public.plans for all using (public.is_admin_or_editor()) with check (public.is_admin_or_editor());

-- Child attempts, AI sessions, pronunciation records (strictly scoped to parent_id / child ownership)
drop policy if exists "parents manage attempts for own children" on public.lesson_attempts;
create policy "parents manage attempts for own children" on public.lesson_attempts
  for all using (
    exists (select 1 from public.child_profiles c where c.id = child_id and c.parent_id = auth.uid())
  ) with check (
    exists (select 1 from public.child_profiles c where c.id = child_id and c.parent_id = auth.uid())
  );

drop policy if exists "parents manage own ai sessions" on public.ai_sessions;
create policy "parents manage own ai sessions" on public.ai_sessions
  for all using (
    parent_id = auth.uid()
    and exists (select 1 from public.child_profiles c where c.id = child_id and c.parent_id = auth.uid())
  ) with check (
    parent_id = auth.uid()
    and exists (select 1 from public.child_profiles c where c.id = child_id and c.parent_id = auth.uid())
  );

drop policy if exists "parents manage own pronunciation records" on public.pronunciation_records;
create policy "parents manage own pronunciation records" on public.pronunciation_records
  for all using (
    parent_id = auth.uid()
    and exists (select 1 from public.child_profiles c where c.id = child_id and c.parent_id = auth.uid())
  ) with check (
    parent_id = auth.uid()
    and exists (select 1 from public.child_profiles c where c.id = child_id and c.parent_id = auth.uid())
  );

-- Subscriptions & Payments: Parents can ONLY SELECT their own records.
-- INSERT/UPDATE/activation MUST happen on server/backend using service_role after MoMo verification.
drop policy if exists "parents read own subscriptions" on public.subscriptions;
create policy "parents read own subscriptions" on public.subscriptions
  for select using (parent_id = auth.uid());

drop policy if exists "parents update cancel flag on own subscriptions" on public.subscriptions;
create policy "parents update cancel flag on own subscriptions" on public.subscriptions
  for update using (parent_id = auth.uid())
  with check (parent_id = auth.uid());

-- Enforce server-only subscription status & plan activation even on authenticated parent updates
create or replace function public.guard_subscription_client_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    if new.plan_id is distinct from old.plan_id
      or new.status is distinct from old.status
      or new.billing_mode is distinct from old.billing_mode
      or new.momo_recurring_capable is distinct from old.momo_recurring_capable
      or new.current_period_start is distinct from old.current_period_start
      or new.current_period_end is distinct from old.current_period_end
      or new.parent_id is distinct from old.parent_id then
      raise exception 'Subscription billing fields can only be updated by verified server';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_guard_subscription_client_update on public.subscriptions;
create trigger trg_guard_subscription_client_update
  before update on public.subscriptions
  for each row execute function public.guard_subscription_client_update();

drop policy if exists "parents read own payments" on public.payments;
create policy "parents read own payments" on public.payments
  for select using (parent_id = auth.uid());
