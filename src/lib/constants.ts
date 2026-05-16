export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL?.trim() || 'https://ehlpmukjdknnyhkycncb.supabase.co';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';

// Todas as chamadas WTS passam por /api/wts/* (Vercel Function proxy) para evitar CORS
// e manter o token server-side. Em dev local sem `vercel dev`, esse path não responde.
export const WTS_BASE = '/api/wts';
export const WTS_TOKEN = ''; // token vive no servidor (env WTS_TOKEN_ESTUDIO_MAIS)
export const WHATSAPP_FROM = '5511956883655';
export const CLIENT_HANDLE = 'estudio-mais';

export const DEFAULT_PANEL_ID = '19440e47-cd18-4dbf-8f7b-1dcc1c71205a';

// Estúdio Mais compartilha o projeto Supabase do Itupeva/Macaé mas isola seus
// dados em tabelas sufixadas. wts_panel_mapping_estudio é uma VIEW que projeta
// wts_panel_mapping_v2 no schema esperado pelo app.
export const TABLE_AUTO_FOLLOWUP_LOG = 'wts_auto_followups_logs_estudio';
export const TABLE_PANEL_MAPPING = 'wts_panel_mapping_estudio';
export const TABLE_FOLLOWUP_RUNS = 'wts_auto_followups_runs_estudio';

export const WTS_RATE_LIMIT_MS = 700;
export const BULK_CONCURRENCY = 5;

export const MSG_MIN = 40;
export const MSG_MAX = 600;
export const BANNED_PHRASES = [
  'aproveite',
  'última chance',
  'desconto especial',
  'oferta imperdível',
  'corra',
] as const;

export type ScenarioKey =
  | 'orcamento_sem_resposta'
  | 'pergunta_sem_resposta'
  | 'agendamento_incompleto'
  | 'interesse_silencio'
  | 'tag_only_no_engagement'
  | 'tag_only_atendimento_ativo'
  | 'tag_only_negocio_fechado'
  | 'tag_only_generic';

export const SCENARIO_LABELS: Record<ScenarioKey, string> = {
  orcamento_sem_resposta: 'Orçamento sem resposta',
  pergunta_sem_resposta: 'Pergunta sem resposta',
  agendamento_incompleto: 'Agendamento incompleto',
  interesse_silencio: 'Interesse + silêncio',
  tag_only_no_engagement: 'Sem engajamento',
  tag_only_atendimento_ativo: 'Atendimento ativo',
  tag_only_negocio_fechado: 'Negócio fechado',
  tag_only_generic: 'Genérico',
};

// AIOS soft palette — paired with the Badge primary/neutral/success/info/danger/warning variants.
export const SCENARIO_COLORS: Record<ScenarioKey, string> = {
  orcamento_sem_resposta:     'bg-warning-soft text-[#92400E]',
  pergunta_sem_resposta:      'bg-[#FFEDD5] text-[#9A3412]',
  agendamento_incompleto:     'bg-info-soft text-info/90',
  interesse_silencio:         'bg-primary-soft text-primary-soft-foreground',
  tag_only_no_engagement:     'bg-muted text-muted-foreground',
  tag_only_atendimento_ativo: 'bg-success-soft text-success/90',
  tag_only_negocio_fechado:   'bg-success-soft text-success',
  tag_only_generic:           'bg-muted text-muted-foreground',
};
