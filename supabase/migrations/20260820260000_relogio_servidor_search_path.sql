-- =============================================================================
-- `relogio_servidor` com search_path fixo
--
-- Era a única função do schema sem `search_path` fixo, apontada pelo linter do
-- Supabase. Não é SECURITY DEFINER, então o risco concreto é baixo — mas a
-- postura do projeto é uniforme e não abre exceção sem motivo (§47).
-- =============================================================================

create or replace function relogio_servidor() returns timestamptz
language sql stable set search_path = public as $$
  select now();
$$;
