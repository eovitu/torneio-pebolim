-- Função SECURITY DEFINER interna: iniciar_torneio a chama em nome do
-- participante autenticado, sem expor consultas de participação por uid.
revoke execute on function public.is_participante_do_torneio(uuid, uuid)
  from public, anon, authenticated;
