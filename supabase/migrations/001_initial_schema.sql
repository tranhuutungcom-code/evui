-- Copy of V1 initial schema for Supabase CLI migration history compatibility
-- English Little World: starter schema.
create extension if not exists pgcrypto;

create table if not exists public.parent_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.child_profiles (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.parent_profiles(id) on delete cascade,
  nickname text not null,
  birth_year smallint,
  learning_level text check (learning_level in ('L1','L2','L3','L4')),
  created_at timestamptz not null default now()
);

create table if not exists public.lessons (
  id text primary key,
  level_id text not null check (level_id in ('L1','L2','L3','L4')),
  title text not null,
  objective text,
  content jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','review','published','archived')),
  version integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  lesson_id text not null references public.lessons(id) on delete cascade,
  status text not null default 'started' check (status in ('started','completed')),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(child_id, lesson_id)
);

create table if not exists public.parent_consents (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.parent_profiles(id) on delete cascade,
  consent_type text not null,
  policy_version text not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);

alter table public.parent_profiles enable row level security;
alter table public.child_profiles enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.parent_consents enable row level security;
alter table public.lessons enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'parent_profiles' and policyname = 'parents read own profile') then
    create policy "parents read own profile" on public.parent_profiles for select using (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'parent_profiles' and policyname = 'parents update own profile') then
    create policy "parents update own profile" on public.parent_profiles for update using (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'parent_profiles' and policyname = 'parents create own profile') then
    create policy "parents create own profile" on public.parent_profiles for insert with check (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'child_profiles' and policyname = 'parents manage own children') then
    create policy "parents manage own children" on public.child_profiles for all using (parent_id = auth.uid()) with check (parent_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'lessons' and policyname = 'read published lessons') then
    create policy "read published lessons" on public.lessons for select using (status = 'published');
  end if;
  if not exists (select 1 from pg_policies where tablename = 'lesson_progress' and policyname = 'parents manage progress for own children') then
    create policy "parents manage progress for own children" on public.lesson_progress
      for all using (
        exists (select 1 from public.child_profiles c where c.id = child_id and c.parent_id = auth.uid())
      ) with check (
        exists (select 1 from public.child_profiles c where c.id = child_id and c.parent_id = auth.uid())
      );
  end if;
  if not exists (select 1 from pg_policies where tablename = 'parent_consents' and policyname = 'parents manage own consents') then
    create policy "parents manage own consents" on public.parent_consents for all using (parent_id = auth.uid()) with check (parent_id = auth.uid());
  end if;
end $$;
