-- =====================================================================
-- DIARIO NIDO — Schema database per Supabase
-- Eseguire TUTTO questo file una volta sola:
-- Dashboard Supabase -> SQL Editor -> New query -> incolla -> Run
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- PROFILI UTENTE (collegati agli account di login)
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null default '',
  email text not null default '',
  ruolo text not null default 'genitore'
    check (ruolo in ('genitore','educatore','amministratore')),
  creato_il timestamptz not null default now()
);

-- Alla registrazione di un nuovo utente viene creato il profilo (ruolo: genitore)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)),
    coalesce(new.email,'')
  );
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Ruolo dell'utente collegato (security definer: evita ricorsione RLS)
create or replace function public.mio_ruolo()
returns text language sql stable security definer set search_path = public as
$$ select ruolo from public.profiles where id = auth.uid() $$;

-- Solo l'amministratore puo' cambiare i ruoli (il SQL Editor resta libero)
create or replace function public.blocca_cambio_ruolo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.ruolo is distinct from old.ruolo
     and auth.uid() is not null
     and public.mio_ruolo() is distinct from 'amministratore' then
    raise exception 'Solo l''amministratore puo'' cambiare i ruoli';
  end if;
  return new;
end; $$;

create trigger trg_blocca_ruolo before update on public.profiles
  for each row execute function public.blocca_cambio_ruolo();

-- ---------------------------------------------------------------------
-- SEZIONI E BAMBINI
-- ---------------------------------------------------------------------
create table public.sezioni (
  id uuid primary key default gen_random_uuid(),
  nome text not null
);

create table public.bambini (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  data_nascita date,
  sezione_id uuid references public.sezioni(id) on delete set null,
  consenso_foto boolean not null default false
);

create table public.bambino_genitore (
  bambino_id uuid references public.bambini(id) on delete cascade,
  genitore_id uuid references public.profiles(id) on delete cascade,
  primary key (bambino_id, genitore_id)
);

-- I bambini associati al genitore collegato
create or replace function public.miei_bambini()
returns setof uuid language sql stable security definer set search_path = public as
$$ select bambino_id from public.bambino_genitore where genitore_id = auth.uid() $$;

-- ---------------------------------------------------------------------
-- PRESENZE / DIARIO / FOTO / AVVISI / MESSAGGI
-- ---------------------------------------------------------------------
create table public.presenze (
  id uuid primary key default gen_random_uuid(),
  bambino_id uuid not null references public.bambini(id) on delete cascade,
  giorno date not null default current_date,
  entrata timestamptz,
  uscita timestamptz,
  registrata_da uuid references public.profiles(id),
  unique (bambino_id, giorno)
);

create table public.attivita (
  id uuid primary key default gen_random_uuid(),
  bambino_id uuid not null references public.bambini(id) on delete cascade,
  tipo text not null check (tipo in ('pasto','sonno','cambio','gioco','nota')),
  descrizione text,
  orario timestamptz not null default now(),
  educatore_id uuid references public.profiles(id)
);

-- Metadati delle foto: il file vero sta nel bucket privato "foto"
create table public.foto (
  id uuid primary key default gen_random_uuid(),
  bambino_id uuid not null references public.bambini(id) on delete cascade,
  percorso text not null,
  didascalia text,
  scattata_il timestamptz not null default now(),
  caricata_da uuid references public.profiles(id)
);

create table public.avvisi (
  id uuid primary key default gen_random_uuid(),
  titolo text not null,
  testo text not null,
  sezione_id uuid references public.sezioni(id) on delete cascade, -- NULL = tutta la scuola
  creato_da uuid references public.profiles(id),
  creato_il timestamptz not null default now()
);

create table public.avvisi_letture (
  avviso_id uuid references public.avvisi(id) on delete cascade,
  utente_id uuid references public.profiles(id) on delete cascade,
  letto_il timestamptz not null default now(),
  primary key (avviso_id, utente_id)
);

create table public.messaggi (
  id uuid primary key default gen_random_uuid(),
  mittente_id uuid not null references public.profiles(id),
  destinatario_id uuid not null references public.profiles(id),
  testo text not null,
  inviato_il timestamptz not null default now(),
  letto_il timestamptz
);

-- =====================================================================
-- SICUREZZA (Row Level Security)
-- Ogni genitore vede SOLO i dati dei propri figli, a livello di database
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.sezioni enable row level security;
alter table public.bambini enable row level security;
alter table public.bambino_genitore enable row level security;
alter table public.presenze enable row level security;
alter table public.attivita enable row level security;
alter table public.foto enable row level security;
alter table public.avvisi enable row level security;
alter table public.avvisi_letture enable row level security;
alter table public.messaggi enable row level security;

-- PROFILI: vedo me stesso; lo staff vede tutti; i genitori vedono lo staff
create policy profiles_select on public.profiles for select using (
  id = auth.uid()
  or public.mio_ruolo() in ('educatore','amministratore')
  or ruolo in ('educatore','amministratore')
);
create policy profiles_update_own on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_update_admin on public.profiles for update
  using (public.mio_ruolo() = 'amministratore')
  with check (public.mio_ruolo() = 'amministratore');

-- SEZIONI: visibili a tutti gli utenti loggati; modificabili dall'admin
create policy sezioni_select on public.sezioni for select using (auth.uid() is not null);
create policy sezioni_admin on public.sezioni for all
  using (public.mio_ruolo() = 'amministratore')
  with check (public.mio_ruolo() = 'amministratore');

-- BAMBINI: staff tutti; genitori solo i propri figli
create policy bambini_select on public.bambini for select using (
  public.mio_ruolo() in ('educatore','amministratore')
  or id in (select public.miei_bambini())
);
create policy bambini_admin on public.bambini for all
  using (public.mio_ruolo() = 'amministratore')
  with check (public.mio_ruolo() = 'amministratore');

-- ASSOCIAZIONI bambino-genitore
create policy bg_select on public.bambino_genitore for select using (
  public.mio_ruolo() in ('educatore','amministratore') or genitore_id = auth.uid()
);
create policy bg_admin on public.bambino_genitore for all
  using (public.mio_ruolo() = 'amministratore')
  with check (public.mio_ruolo() = 'amministratore');

-- PRESENZE: staff legge/scrive; genitori leggono solo i propri figli
create policy presenze_select on public.presenze for select using (
  public.mio_ruolo() in ('educatore','amministratore')
  or bambino_id in (select public.miei_bambini())
);
create policy presenze_write on public.presenze for insert
  with check (public.mio_ruolo() in ('educatore','amministratore'));
create policy presenze_update on public.presenze for update
  using (public.mio_ruolo() in ('educatore','amministratore'))
  with check (public.mio_ruolo() in ('educatore','amministratore'));

-- ATTIVITA (diario di bordo)
create policy attivita_select on public.attivita for select using (
  public.mio_ruolo() in ('educatore','amministratore')
  or bambino_id in (select public.miei_bambini())
);
create policy attivita_insert on public.attivita for insert
  with check (public.mio_ruolo() in ('educatore','amministratore'));
create policy attivita_delete on public.attivita for delete
  using (public.mio_ruolo() in ('educatore','amministratore'));

-- FOTO (metadati)
create policy foto_select on public.foto for select using (
  public.mio_ruolo() in ('educatore','amministratore')
  or bambino_id in (select public.miei_bambini())
);
create policy foto_insert on public.foto for insert
  with check (public.mio_ruolo() in ('educatore','amministratore'));
create policy foto_delete on public.foto for delete
  using (public.mio_ruolo() in ('educatore','amministratore'));

-- AVVISI: staff tutti; genitori quelli generali o della sezione dei figli
create policy avvisi_select on public.avvisi for select using (
  public.mio_ruolo() in ('educatore','amministratore')
  or sezione_id is null
  or sezione_id in (select sezione_id from public.bambini where id in (select public.miei_bambini()))
);
create policy avvisi_insert on public.avvisi for insert
  with check (public.mio_ruolo() in ('educatore','amministratore'));
create policy avvisi_delete on public.avvisi for delete
  using (public.mio_ruolo() = 'amministratore' or creato_da = auth.uid());

-- CONFERME DI LETTURA avvisi
create policy letture_insert on public.avvisi_letture for insert
  with check (utente_id = auth.uid());
create policy letture_select on public.avvisi_letture for select using (
  utente_id = auth.uid() or public.mio_ruolo() in ('educatore','amministratore')
);

-- MESSAGGI: solo mittente e destinatario
create policy messaggi_select on public.messaggi for select using (
  mittente_id = auth.uid() or destinatario_id = auth.uid()
);
create policy messaggi_insert on public.messaggi for insert
  with check (mittente_id = auth.uid());
create policy messaggi_letto on public.messaggi for update
  using (destinatario_id = auth.uid()) with check (destinatario_id = auth.uid());

-- =====================================================================
-- STORAGE: bucket PRIVATO per le foto
-- Percorso dei file: <id_bambino>/<timestamp>.jpg
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('foto','foto', false)
on conflict (id) do nothing;

create policy storage_foto_staff on storage.objects for all using (
  bucket_id = 'foto' and public.mio_ruolo() in ('educatore','amministratore')
) with check (
  bucket_id = 'foto' and public.mio_ruolo() in ('educatore','amministratore')
);

create policy storage_foto_genitori on storage.objects for select using (
  bucket_id = 'foto'
  and (split_part(name,'/',1))::uuid in (select public.miei_bambini())
);

-- =====================================================================
-- DOPO AVER ESEGUITO QUESTO FILE:
-- 1) Registrati nell'app con la tua email
-- 2) Torna nel SQL Editor e promuoviti amministratore:
--    update public.profiles set ruolo = 'amministratore'
--    where email = 'TUA_EMAIL@ESEMPIO.IT';
-- =====================================================================
