create table if not exists projects (
  id bigint generated always as identity primary key,
  sort_order integer not null default 100,
  period text,
  role text,
  title text not null,
  summary text not null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists ai_notes (
  id bigint generated always as identity primary key,
  sort_order integer not null default 100,
  title text not null,
  summary text not null,
  created_at timestamptz not null default now()
);

create table if not exists tools (
  id bigint generated always as identity primary key,
  sort_order integer not null default 100,
  type text,
  name text not null,
  summary text not null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists articles (
  id bigint generated always as identity primary key,
  slug text unique,
  published_at date,
  category text,
  title text not null,
  summary text not null,
  reading_time text,
  featured boolean not null default false,
  tags text[] not null default '{}',
  content text,
  url text,
  created_at timestamptz not null default now()
);

alter table projects enable row level security;
alter table ai_notes enable row level security;
alter table tools enable row level security;
alter table articles enable row level security;

create policy "Public read projects"
  on projects for select
  using (true);

create policy "Public read ai notes"
  on ai_notes for select
  using (true);

create policy "Public read tools"
  on tools for select
  using (true);

create policy "Public read articles"
  on articles for select
  using (true);
