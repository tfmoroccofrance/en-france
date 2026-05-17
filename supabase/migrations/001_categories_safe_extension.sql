create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamp with time zone default now()
);

insert into public.categories (name, slug) values
('Recettes économiques', 'recettes-economiques'),
('Recettes facile', 'recettes-facile'),
('Repas rapide', 'repas-rapide'),
('Cuisine', 'cuisine')
on conflict (slug) do update set
  name = excluded.name;

alter table public.posts
add column if not exists category_slug text;

create index if not exists posts_category_slug_idx
on public.posts (category_slug);
