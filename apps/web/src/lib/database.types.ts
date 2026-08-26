/**
 * Tipos do banco — GERADO AUTOMATICAMENTE. Não editar à mão.
 *
 * Regerar após qualquer migration:
 *   supabase gen types typescript --project-id fgbpeuanyoefjcywhvkh > apps/web/src/lib/database.types.ts
 *
 * (ou via MCP do Supabase: generate_typescript_types)
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.15'
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          acao: string
          actor_user_id: string | null
          created_at: string
          dados_antes: Json | null
          dados_depois: Json | null
          entidade: string
          entidade_id: string | null
          id: number
          motivo: string | null
          tournament_id: string | null
        }
        Insert: {
          acao: string
          actor_user_id?: string | null
          created_at?: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          entidade: string
          entidade_id?: string | null
          id?: never
          motivo?: string | null
          tournament_id?: string | null
        }
        Update: {
          acao?: string
          actor_user_id?: string | null
          created_at?: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          entidade?: string
          entidade_id?: string | null
          id?: never
          motivo?: string | null
          tournament_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'admin_audit_log_tournament_id_fkey'
            columns: ['tournament_id']
            isOneToOne: false
            referencedRelation: 'tournaments'
            referencedColumns: ['id']
          },
        ]
      }
      app_config: {
        Row: { chave: string; updated_at: string; valor: string }
        Insert: { chave: string; updated_at?: string; valor: string }
        Update: { chave?: string; updated_at?: string; valor?: string }
        Relationships: []
      }
      match_events: {
        Row: {
          clock_ms: number
          created_at: string
          created_by: string | null
          goal_value: number | null
          id: string
          match_id: string
          player_id: string | null
          reason: string | null
          removed_event_id: string | null
          seq: number
          team_id: string | null
          type: Database['public']['Enums']['match_event_type']
        }
        Insert: {
          clock_ms: number
          created_at?: string
          created_by?: string | null
          goal_value?: number | null
          id?: string
          match_id: string
          player_id?: string | null
          reason?: string | null
          removed_event_id?: string | null
          seq: number
          team_id?: string | null
          type: Database['public']['Enums']['match_event_type']
        }
        Update: {
          clock_ms?: number
          created_at?: string
          created_by?: string | null
          goal_value?: number | null
          id?: string
          match_id?: string
          player_id?: string | null
          reason?: string | null
          removed_event_id?: string | null
          seq?: number
          team_id?: string | null
          type?: Database['public']['Enums']['match_event_type']
        }
        Relationships: [
          {
            foreignKeyName: 'match_events_match_id_fkey'
            columns: ['match_id']
            isOneToOne: false
            referencedRelation: 'matches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'match_events_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'match_events_removed_event_id_fkey'
            columns: ['removed_event_id']
            isOneToOne: true
            referencedRelation: 'match_events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'match_events_team_id_fkey'
            columns: ['team_id']
            isOneToOne: false
            referencedRelation: 'teams'
            referencedColumns: ['id']
          },
        ]
      }
      match_lineups: {
        Row: { created_at: string; match_id: string; player_id: string; team_id: string }
        Insert: { created_at?: string; match_id: string; player_id: string; team_id: string }
        Update: { created_at?: string; match_id?: string; player_id?: string; team_id?: string }
        Relationships: [
          {
            foreignKeyName: 'match_lineups_match_id_fkey'
            columns: ['match_id']
            isOneToOne: false
            referencedRelation: 'matches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'match_lineups_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'match_lineups_team_id_fkey'
            columns: ['team_id']
            isOneToOne: false
            referencedRelation: 'teams'
            referencedColumns: ['id']
          },
        ]
      }
      matches: {
        Row: {
          accumulated_paused_ms: number
          agendada_para: string | null
          arbitro_user_id: string | null
          condicao_termino: Database['public']['Enums']['condicao_de_termino'] | null
          created_at: string
          finished_at: string | null
          gols_para_vencer: number | null
          id: string
          iniciada_por: string | null
          label: string
          ordem: number
          paused_at: string | null
          phase_id: string
          phase_kind: Database['public']['Enums']['phase_kind']
          rodizio_resolvido_em: string | null
          slot: string | null
          started_at: string | null
          status: Database['public']['Enums']['match_status']
          status_antes_pausa: Database['public']['Enums']['match_status'] | null
          team_a_id: string
          team_b_id: string
          tournament_id: string
          updated_at: string
        }
        Insert: {
          accumulated_paused_ms?: number
          agendada_para?: string | null
          arbitro_user_id?: string | null
          condicao_termino?: Database['public']['Enums']['condicao_de_termino'] | null
          created_at?: string
          finished_at?: string | null
          gols_para_vencer?: number | null
          id?: string
          iniciada_por?: string | null
          label: string
          ordem: number
          paused_at?: string | null
          phase_id: string
          phase_kind: Database['public']['Enums']['phase_kind']
          rodizio_resolvido_em?: string | null
          slot?: string | null
          started_at?: string | null
          status?: Database['public']['Enums']['match_status']
          status_antes_pausa?: Database['public']['Enums']['match_status'] | null
          team_a_id: string
          team_b_id: string
          tournament_id: string
          updated_at?: string
        }
        Update: {
          accumulated_paused_ms?: number
          agendada_para?: string | null
          arbitro_user_id?: string | null
          condicao_termino?: Database['public']['Enums']['condicao_de_termino'] | null
          created_at?: string
          finished_at?: string | null
          gols_para_vencer?: number | null
          id?: string
          iniciada_por?: string | null
          label?: string
          ordem?: number
          paused_at?: string | null
          phase_id?: string
          phase_kind?: Database['public']['Enums']['phase_kind']
          rodizio_resolvido_em?: string | null
          slot?: string | null
          started_at?: string | null
          status?: Database['public']['Enums']['match_status']
          status_antes_pausa?: Database['public']['Enums']['match_status'] | null
          team_a_id?: string
          team_b_id?: string
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'matches_phase_id_tournament_id_phase_kind_fkey'
            columns: ['phase_id', 'tournament_id', 'phase_kind']
            isOneToOne: false
            referencedRelation: 'phases'
            referencedColumns: ['id', 'tournament_id', 'kind']
          },
          {
            foreignKeyName: 'matches_team_a_id_tournament_id_fkey'
            columns: ['team_a_id', 'tournament_id']
            isOneToOne: false
            referencedRelation: 'teams'
            referencedColumns: ['id', 'tournament_id']
          },
          {
            foreignKeyName: 'matches_team_b_id_tournament_id_fkey'
            columns: ['team_b_id', 'tournament_id']
            isOneToOne: false
            referencedRelation: 'teams'
            referencedColumns: ['id', 'tournament_id']
          },
          {
            foreignKeyName: 'matches_tournament_id_fkey'
            columns: ['tournament_id']
            isOneToOne: false
            referencedRelation: 'tournaments'
            referencedColumns: ['id']
          },
        ]
      }
      phases: {
        Row: {
          chaveamento: Json | null
          created_at: string
          encerrada_em: string | null
          id: string
          kind: Database['public']['Enums']['phase_kind']
          nome: string
          ordem: number
          tournament_id: string
        }
        Insert: {
          chaveamento?: Json | null
          created_at?: string
          encerrada_em?: string | null
          id?: string
          kind: Database['public']['Enums']['phase_kind']
          nome: string
          ordem: number
          tournament_id: string
        }
        Update: {
          chaveamento?: Json | null
          created_at?: string
          encerrada_em?: string | null
          id?: string
          kind?: Database['public']['Enums']['phase_kind']
          nome?: string
          ordem?: number
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'phases_tournament_id_fkey'
            columns: ['tournament_id']
            isOneToOne: false
            referencedRelation: 'tournaments'
            referencedColumns: ['id']
          },
        ]
      }
      players: {
        Row: {
          created_at: string
          foto_url: string | null
          id: string
          nome: string
          profile_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          foto_url?: string | null
          id?: string
          nome: string
          profile_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          foto_url?: string | null
          id?: string
          nome?: string
          profile_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'players_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          data_nascimento: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          data_nascimento?: string | null
          id: string
          nome: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          data_nascimento?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      rules_acceptance: {
        Row: {
          accepted_at: string
          accepted_rules_version: string
          id: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          accepted_rules_version: string
          id?: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          accepted_rules_version?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      team_players: {
        Row: {
          created_at: string
          goleiro: boolean
          player_id: string
          team_id: string
          tournament_id: string
        }
        Insert: {
          created_at?: string
          goleiro?: boolean
          player_id: string
          team_id: string
          tournament_id: string
        }
        Update: {
          created_at?: string
          goleiro?: boolean
          player_id?: string
          team_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'team_players_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'team_players_team_id_tournament_id_fkey'
            columns: ['team_id', 'tournament_id']
            isOneToOne: false
            referencedRelation: 'teams'
            referencedColumns: ['id', 'tournament_id']
          },
        ]
      }
      clubs: {
        Row: {
          cor_primaria: string | null
          created_at: string
          criado_por: string | null
          descricao: string | null
          id: string
          logo_url: string | null
          nome: string
          updated_at: string
        }
        Insert: {
          cor_primaria?: string | null
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          logo_url?: string | null
          nome: string
          updated_at?: string
        }
        Update: {
          cor_primaria?: string | null
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          logo_url?: string | null
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      club_members: {
        Row: { club_id: string; created_at: string; player_id: string }
        Insert: { club_id: string; created_at?: string; player_id: string }
        Update: { club_id?: string; created_at?: string; player_id?: string }
        Relationships: [
          {
            foreignKeyName: 'club_members_club_id_fkey'
            columns: ['club_id']
            isOneToOne: false
            referencedRelation: 'clubs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'club_members_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
        ]
      }
      teams: {
        Row: {
          club_id: string | null
          cor_primaria: string | null
          created_at: string
          descricao: string | null
          id: string
          logo_url: string | null
          nome: string
          tournament_id: string
          updated_at: string
        }
        Insert: {
          club_id?: string | null
          cor_primaria?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          logo_url?: string | null
          nome: string
          tournament_id: string
          updated_at?: string
        }
        Update: {
          club_id?: string | null
          cor_primaria?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          logo_url?: string | null
          nome?: string
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'teams_tournament_id_fkey'
            columns: ['tournament_id']
            isOneToOne: false
            referencedRelation: 'tournaments'
            referencedColumns: ['id']
          },
        ]
      }
      tournament_participants: {
        Row: {
          auto_inscrito: boolean
          created_at: string
          inscrito_por: string | null
          player_id: string
          tournament_id: string
        }
        Insert: {
          auto_inscrito?: boolean
          created_at?: string
          inscrito_por?: string | null
          player_id: string
          tournament_id: string
        }
        Update: {
          auto_inscrito?: boolean
          created_at?: string
          inscrito_por?: string | null
          player_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tournament_participants_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tournament_participants_tournament_id_fkey'
            columns: ['tournament_id']
            isOneToOne: false
            referencedRelation: 'tournaments'
            referencedColumns: ['id']
          },
        ]
      }
      tournaments: {
        Row: {
          condicao_termino: Database['public']['Enums']['condicao_de_termino']
          created_at: string
          criado_por: string
          gols_para_vencer: number | null
          id: string
          jogadores_por_equipe: number
          max_equipes: number
          nome: string
          publico: boolean
          rules_version: string
          slug: string
          status: Database['public']['Enums']['tournament_status']
          trofeu_skin: string
          updated_at: string
        }
        Insert: {
          condicao_termino?: Database['public']['Enums']['condicao_de_termino']
          created_at?: string
          criado_por: string
          gols_para_vencer?: number | null
          id?: string
          jogadores_por_equipe?: number
          max_equipes?: number
          nome: string
          publico?: boolean
          rules_version: string
          slug: string
          status?: Database['public']['Enums']['tournament_status']
          trofeu_skin?: string
          updated_at?: string
        }
        Update: {
          condicao_termino?: Database['public']['Enums']['condicao_de_termino']
          created_at?: string
          criado_por?: string
          gols_para_vencer?: number | null
          id?: string
          jogadores_por_equipe?: number
          max_equipes?: number
          nome?: string
          publico?: boolean
          rules_version?: string
          slug?: string
          status?: Database['public']['Enums']['tournament_status']
          trofeu_skin?: string
          updated_at?: string
        }
        Relationships: []
      }
      trofeus: {
        Row: {
          conquistado_em: string
          id: string
          player_id: string
          posicao: Database['public']['Enums']['trofeu_posicao']
          team_id: string
          tournament_id: string
        }
        Insert: {
          conquistado_em?: string
          id?: string
          player_id: string
          posicao: Database['public']['Enums']['trofeu_posicao']
          team_id: string
          tournament_id: string
        }
        Update: {
          conquistado_em?: string
          id?: string
          player_id?: string
          posicao?: Database['public']['Enums']['trofeu_posicao']
          team_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'trofeus_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'trofeus_team_id_tournament_id_fkey'
            columns: ['team_id', 'tournament_id']
            isOneToOne: false
            referencedRelation: 'teams'
            referencedColumns: ['id', 'tournament_id']
          },
          {
            foreignKeyName: 'trofeus_tournament_id_fkey'
            columns: ['tournament_id']
            isOneToOne: false
            referencedRelation: 'tournaments'
            referencedColumns: ['id']
          },
        ]
      }
      user_roles: {
        Row: {
          concedido_por: string | null
          created_at: string
          role: Database['public']['Enums']['app_role']
          user_id: string
        }
        Insert: {
          concedido_por?: string | null
          created_at?: string
          role: Database['public']['Enums']['app_role']
          user_id: string
        }
        Update: {
          concedido_por?: string | null
          created_at?: string
          role?: Database['public']['Enums']['app_role']
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      conceder_papel: {
        Args: { p_role: Database['public']['Enums']['app_role']; p_user_id: string }
        Returns: undefined
      }
      criar_partida_mata_mata: {
        Args: {
          p_agendada_para?: string | null
          p_phase_id: string
          p_team_a_id: string
          p_team_b_id: string
        }
        Returns: Database['public']['Tables']['matches']['Row']
      }
      encerrar_fase: {
        Args: { p_phase_id: string }
        Returns: Database['public']['Tables']['phases']['Row']
      }
      gerar_partidas_grupo: { Args: { p_phase_id: string }; Returns: number }
      avancar_mata_mata: { Args: { p_phase_id: string }; Returns: number }
      classificacao_da_fase: {
        Args: { p_phase_id: string }
        Returns: { pos: number; pts: number; saldo: number; team_id: string }[]
      }
      conceder_trofeus: { Args: { p_phase_id: string }; Returns: number }
      configurar_partida: {
        Args: {
          p_match_id: string
          p_condicao?: Database['public']['Enums']['condicao_de_termino'] | null
          p_gols?: number | null
        }
        Returns: Database['public']['Tables']['matches']['Row']
      }
      configurar_termino_do_torneio: {
        Args: {
          p_tournament_id: string
          p_condicao: Database['public']['Enums']['condicao_de_termino']
          p_gols?: number | null
        }
        Returns: Database['public']['Tables']['tournaments']['Row']
      }
      excluir_partida: { Args: { p_match_id: string }; Returns: undefined }
      reabrir_fase: {
        Args: { p_phase_id: string }
        Returns: Database['public']['Tables']['phases']['Row']
      }
      gerar_mata_mata: {
        Args: { p_phase_id: string; p_team_ids?: string[] | null }
        Returns: number
      }
      podio_do_mata_mata: {
        Args: { p_phase_id: string }
        Returns: {
          posicao: Database['public']['Enums']['trofeu_posicao']
          team_id: string
        }[]
      }
      regra_de_termino: {
        Args: { p_match_id: string }
        Returns: {
          condicao: Database['public']['Enums']['condicao_de_termino']
          gols_para_vencer: number | null
        }[]
      }
      gerar_eliminacao_dupla: {
        Args: { p_phase_id: string; p_team_ids?: string[] | null }
        Returns: number
      }
      avancar_eliminacao_dupla: { Args: { p_phase_id: string }; Returns: number }
      montar_eliminacao_dupla: { Args: { p_equipes: number }; Returns: Json }
      sortear_equipes: {
        Args: {
          p_nomes_equipes?: string[] | null
          /** Ausente ou nulo: sorteia com todos os inscritos do torneio. */
          p_player_ids?: string[] | null
          p_seed?: number | null
          p_tournament_id: string
        }
        Returns: { equipe: string; jogador: string; player_id: string; team_id: string }[]
      }
      desfazer_sorteio: { Args: { p_tournament_id: string }; Returns: undefined }
      iniciar_torneio: {
        Args: { p_tournament_id: string }
        Returns: Database['public']['Tables']['tournaments']['Row']
      }
      is_participante_do_torneio: {
        Args: { p_tournament_id: string; uid: string }
        Returns: boolean
      }
      resolver_rodizio: { Args: { p_match_id: string; p_aceitar: boolean }; Returns: undefined }
      rodizio_sugerido: {
        Args: { p_match_id: string }
        Returns: {
          vai_player_id: string
          vai_nome: string
          vai_sozinho: number
          fica_player_id: string
          fica_nome: string
          fica_sozinho: number
          de_team_id: string
          de_equipe: string
          para_team_id: string
          para_equipe: string
          solitario_nome: string
        }[]
      }
      composicao_de_equipes: {
        Args: { p_total: number }
        Returns: { duplas: number; solos: number; equipes: number }
      }
      elapsed_ms: {
        Args: { agora: string; m: Database['public']['Tables']['matches']['Row'] }
        Returns: number
      }
      encerrar_partida: {
        Args: { p_match_id: string }
        Returns: Database['public']['Tables']['matches']['Row']
      }
      iniciar_partida: {
        Args: { p_match_id: string }
        Returns: Database['public']['Tables']['matches']['Row']
      }
      excluir_torneio: { Args: { p_tournament_id: string }; Returns: undefined }
      inscrever_se_no_torneio: { Args: { p_tournament_id: string }; Returns: string }
      sair_do_torneio: { Args: { p_tournament_id: string }; Returns: undefined }
      relogio_servidor: { Args: Record<string, never>; Returns: string }
      vincular_jogador_conta: {
        Args: { p_player_id: string; p_user_id: string | null }
        Returns: Database['public']['Tables']['players']['Row']
      }
      is_admin: { Args: { uid: string }; Returns: boolean }
      is_factory_admin: { Args: { uid: string }; Returns: boolean }
      is_jogador_do_torneio: {
        Args: { p_tournament_id: string; uid: string }
        Returns: boolean
      }
      is_operador_da_partida: {
        Args: { p_match_id: string; uid: string }
        Returns: boolean
      }
      pausar_partida: {
        Args: { p_match_id: string }
        Returns: Database['public']['Tables']['matches']['Row']
      }
      placar_partida: {
        Args: { p_match_id: string }
        Returns: Record<string, unknown>
      }
      registrar_auditoria: {
        Args: {
          p_acao: string
          p_antes?: Json
          p_depois?: Json
          p_entidade: string
          p_entidade_id: string
          p_motivo?: string
          p_tournament_id?: string
        }
        Returns: undefined
      }
      registrar_gol: {
        Args: {
          p_match_id: string
          p_player_id: string
          p_team_id: string
          p_type: Database['public']['Enums']['match_event_type']
        }
        Returns: Database['public']['Tables']['match_events']['Row']
      }
      remover_gol: {
        Args: { p_event_id: string; p_match_id: string; p_motivo?: string }
        Returns: Database['public']['Tables']['match_events']['Row']
      }
      retomar_partida: {
        Args: { p_match_id: string }
        Returns: Database['public']['Tables']['matches']['Row']
      }
      revogar_papel: {
        Args: { p_role: Database['public']['Enums']['app_role']; p_user_id: string }
        Returns: undefined
      }
      sincronizar_escalacao: { Args: { p_match_id: string }; Returns: undefined }
      ressincronizar_escalacao: { Args: { p_match_id: string }; Returns: number }
      salvar_equipe_como_clube: {
        Args: { p_team_id: string }
        Returns: Database['public']['Tables']['clubs']['Row']
      }
      formar_equipes_manual: {
        Args: { p_tournament_id: string; p_equipes: Json }
        Returns: { equipe: string; jogador: string; player_id: string; team_id: string }[]
      }
      resetar_partida: {
        Args: { p_match_id: string }
        Returns: Database['public']['Tables']['matches']['Row']
      }
    }
    Enums: {
      app_role: 'PLAYER' | 'ADMIN' | 'FACTORY_ADMIN'
      condicao_de_termino: 'TEMPO' | 'GOLS'
      match_event_type:
        | 'NORMAL_GOAL'
        | 'KEEPER_GOAL'
        | 'OWN_GOAL'
        | 'GOAL_REMOVED'
        | 'MATCH_STARTED'
        | 'MATCH_PAUSED'
        | 'MATCH_RESUMED'
        | 'GOLDEN_GOAL_STARTED'
        | 'MATCH_FINISHED'
      match_status: 'SCHEDULED' | 'LIVE' | 'PAUSED' | 'GOLDEN_GOAL' | 'FINISHED'
      phase_kind: 'GROUP' | 'KNOCKOUT' | 'DOUBLE_ELIMINATION'
      tournament_status: 'CONFIGURACAO' | 'AGUARDANDO_INICIO' | 'EM_ANDAMENTO' | 'ENCERRADO'
      trofeu_posicao: 'CAMPEAO' | 'VICE' | 'TERCEIRO'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database['public']

export type Tables<T extends keyof DefaultSchema['Tables']> = DefaultSchema['Tables'][T]['Row']

export type TablesInsert<T extends keyof DefaultSchema['Tables']> =
  DefaultSchema['Tables'][T]['Insert']

export type TablesUpdate<T extends keyof DefaultSchema['Tables']> =
  DefaultSchema['Tables'][T]['Update']

export type Enums<T extends keyof DefaultSchema['Enums']> = DefaultSchema['Enums'][T]
