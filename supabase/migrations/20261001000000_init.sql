-- MediStock schema v1 (spec §3). Shared by the web and mobile apps.


-- ---------- Profiles and roles ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  role text not null default 'assistant' check (role in ('admin', 'pharmacist', 'assistant')),
  created_at timestamptz not null default now()
);

-- The first user to sign up becomes admin; everyone after starts as assistant.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    case when exists (select 1 from public.profiles) then 'assistant' else 'admin' end
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.app_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

-- ---------- Reference data ----------
create table public.settings (
  id int primary key default 1 check (id = 1),
  pharmacy_name text not null default 'My Pharmacy',
  currency text not null default 'PKR',
  band_critical_days int not null default 30 check (band_critical_days > 0),
  band_soon_days int not null default 90,
  default_reorder_level int not null default 50,
  check (band_soon_days > band_critical_days)
);
insert into public.settings (id) values (1);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('shelf', 'fridge', 'safe'))
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text not null default '',
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  lead_time_days int not null default 3,
  return_window_days int not null default 90,
  payment_terms text not null default '',
  notes text not null default '',
  is_active boolean not null default true,
  on_time_rate numeric(4, 3) not null default 1
);

create table public.medicines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  generic_name text not null default '',
  strength text not null default '',
  form text not null default '',
  pack_size int not null default 1 check (pack_size > 0),
  category text not null default '',
  barcode text unique,
  storage text not null default 'room' check (storage in ('room', 'cold', 'controlled')),
  schedule text not null default 'otc' check (schedule in ('otc', 'rx', 'controlled')),
  reorder_level int not null default 50,
  location_id uuid references public.locations (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Stock ----------
create table public.batches (
  id uuid primary key default gen_random_uuid(),
  medicine_id uuid not null references public.medicines (id) on delete cascade,
  supplier_id uuid references public.suppliers (id) on delete set null,
  lot_number text not null,
  expiry_date date not null,
  qty_on_hand int not null default 0 check (qty_on_hand >= 0),
  unit_cost numeric(12, 2) not null default 0,
  unit_price numeric(12, 2) not null default 0,
  received_at timestamptz not null default now(),
  invoice_ref text,
  location_id uuid references public.locations (id) on delete set null,
  status text not null default 'active' check (status in ('active', 'quarantined', 'returned', 'disposed', 'depleted'))
);
create index batches_medicine_expiry on public.batches (medicine_id, expiry_date);
create index batches_expiry_active on public.batches (expiry_date) where status = 'active';

-- Append-only audit trail of every quantity change.
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches (id) on delete cascade,
  type text not null check (type in ('receive', 'dispense', 'adjust', 'transfer', 'return', 'dispose')),
  qty int not null,
  reason text,
  reference text,
  user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index stock_movements_batch on public.stock_movements (batch_id);
create index stock_movements_created on public.stock_movements (created_at desc);

-- ---------- Orders ----------
create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  supplier_id uuid not null references public.suppliers (id),
  status text not null default 'draft' check (status in ('draft', 'sent', 'partial', 'received', 'cancelled')),
  ordered_at timestamptz,
  expected_at date,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.po_lines (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references public.purchase_orders (id) on delete cascade,
  medicine_id uuid not null references public.medicines (id),
  qty_ordered int not null check (qty_ordered > 0),
  qty_received int not null default 0 check (qty_received >= 0),
  unit_cost numeric(12, 2) not null default 0
);

-- ---------- Alerts ----------
-- Alerts are computed from batches and stock levels; this table stores acknowledge/resolve state by alert key.
create table public.alerts (
  key text primary key,
  status text not null check (status in ('acknowledged', 'resolved')),
  updated_at timestamptz not null default now(),
  user_id uuid references public.profiles (id) on delete set null
);

-- ---------- Row-level security ----------
alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.locations enable row level security;
alter table public.suppliers enable row level security;
alter table public.medicines enable row level security;
alter table public.batches enable row level security;
alter table public.stock_movements enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.po_lines enable row level security;
alter table public.alerts enable row level security;

-- Every signed-in staff member can read everything.
create policy "staff read" on public.profiles for select to authenticated using (true);
create policy "staff read" on public.settings for select to authenticated using (true);
create policy "staff read" on public.locations for select to authenticated using (true);
create policy "staff read" on public.suppliers for select to authenticated using (true);
create policy "staff read" on public.medicines for select to authenticated using (true);
create policy "staff read" on public.batches for select to authenticated using (true);
create policy "staff read" on public.stock_movements for select to authenticated using (true);
create policy "staff read" on public.purchase_orders for select to authenticated using (true);
create policy "staff read" on public.po_lines for select to authenticated using (true);
create policy "staff read" on public.alerts for select to authenticated using (true);

-- Admin only: settings, locations, user roles.
create policy "admin write" on public.settings for all to authenticated
  using (public.app_role() = 'admin') with check (public.app_role() = 'admin');
create policy "admin write" on public.locations for all to authenticated
  using (public.app_role() = 'admin') with check (public.app_role() = 'admin');
create policy "admin write" on public.profiles for update to authenticated
  using (public.app_role() = 'admin') with check (public.app_role() = 'admin');

-- Pharmacist and admin: catalogue, suppliers, orders.
create policy "pharmacist write" on public.medicines for all to authenticated
  using (public.app_role() in ('admin', 'pharmacist')) with check (public.app_role() in ('admin', 'pharmacist'));
create policy "pharmacist write" on public.suppliers for all to authenticated
  using (public.app_role() in ('admin', 'pharmacist')) with check (public.app_role() in ('admin', 'pharmacist'));
create policy "pharmacist write" on public.purchase_orders for all to authenticated
  using (public.app_role() in ('admin', 'pharmacist')) with check (public.app_role() in ('admin', 'pharmacist'));
create policy "pharmacist write" on public.po_lines for all to authenticated
  using (public.app_role() in ('admin', 'pharmacist')) with check (public.app_role() in ('admin', 'pharmacist'));
create policy "pharmacist write" on public.alerts for all to authenticated
  using (public.app_role() in ('admin', 'pharmacist')) with check (public.app_role() in ('admin', 'pharmacist'));

-- All staff receive and dispense, so all can write batches; status changes beyond that are pharmacist+.
create policy "staff insert" on public.batches for insert to authenticated with check (public.app_role() is not null);
create policy "staff update" on public.batches for update to authenticated
  using (public.app_role() is not null)
  with check (public.app_role() in ('admin', 'pharmacist') or status in ('active', 'depleted'));

-- Movements: insert only (no update/delete policies, so the audit trail is immutable).
-- Assistants may only record receipts and dispensing, and only as themselves.
create policy "staff insert" on public.stock_movements for insert to authenticated with check (
  user_id = auth.uid()
  and (public.app_role() in ('admin', 'pharmacist') or type in ('receive', 'dispense'))
);
