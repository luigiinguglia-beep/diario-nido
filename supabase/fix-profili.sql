-- =====================================================================
-- RIPARAZIONE: profili mancanti
-- Da eseguire quando un utente si e' registrato ma l'app mostra
-- pagina bianca (la sua scheda profilo non esiste nel database).
-- SQL Editor -> New query -> incolla tutto -> Run
-- =====================================================================

-- 1) Crea la scheda profilo per tutti gli account che ne sono privi
insert into public.profiles (id, nome, email)
select u.id,
       coalesce(u.raw_user_meta_data->>'nome', split_part(u.email,'@',1)),
       coalesce(u.email,'')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- 2) Permette all'app di ricreare da sola il proprio profilo se assente
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert
  with check (id = auth.uid());

-- 3) Ripeti la promozione ad amministratore (METTI LA TUA EMAIL):
update public.profiles set ruolo = 'amministratore'
where email = 'tua_email@esempio.it';

-- 4) Verifica: deve comparire la tua riga con ruolo 'amministratore'
select email, ruolo from public.profiles;
