-- =====================================================================
-- AGGIORNAMENTO 2: scheda Bambini (foto profilo) + video con scadenza
-- SQL Editor -> New query -> incolla tutto -> Run
-- =====================================================================

-- Foto profilo (facoltativa) del bambino
alter table public.bambini add column if not exists foto_profilo text;

-- Tipo di media: foto o video (le righe esistenti diventano 'foto')
alter table public.foto add column if not exists tipo text not null default 'foto';
alter table public.foto drop constraint if exists foto_tipo_check;
alter table public.foto add constraint foto_tipo_check check (tipo in ('foto','video'));
