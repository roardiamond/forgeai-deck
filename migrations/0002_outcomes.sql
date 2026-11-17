create table if not exists outcomes (
  id text primary key,
  user_id text not null,
  title text not null,
  kind text not null,
  source_name text not null default '',
  source_excerpt text not null,
  source_text text not null,
  result_markdown text not null,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint outcomes_kind_chk check (
    kind in ('report', 'action', 'document', 'code', 'insights')
  )
);

create index if not exists outcomes_user_updated_idx
  on outcomes (user_id, updated_at desc);
