export type ActionStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'executed'
  | 'failed';

export type Mode =
  | 'shadow'
  | 'executed'
  | 'skipped_not_fu'
  | 'skipped_low_conf'
  | 'skipped_cooldown'
  | 'error';

// DB check constraint: ('move' | 'create' | 'none') OR null
export type CardAction = 'move' | 'create' | 'none';

export type WtsErrorEntry = { ok: boolean; status?: number; error?: string };

export type SuggestionRow = {
  id: number;
  client_handle: string;
  session_id: string;
  customer_phone: string | null;
  customer_name: string | null;
  contact_id: string | null;

  responsible_user_id: string | null;
  responsible_user_name: string | null;

  classified_at: string;
  mode: Mode;
  is_followup: boolean | null;
  suggest_message: boolean | null;
  confidence: number | null;

  tag_applied: string | null;
  column_applied: string | null;
  message_sent: string | null;

  suggested_tag_id: string | null;
  suggested_step_id: string | null;
  current_tag_ids: string[] | null;
  current_tag_names: string[] | null;
  no_history: boolean | null;

  reasoning_short: string | null;
  scenario: string | null;
  error_reason: string | null;

  action_status: ActionStatus | null;
  human_message_override: string | null;
  actioned_by: string | null;
  actioned_at: string | null;

  wts_tag_applied_at: string | null;
  wts_card_moved_at: string | null;
  wts_message_sent_at: string | null;
  wts_errors: Record<string, WtsErrorEntry> | null;

  card_action: CardAction | null;
  card_id_used: string | null;

  raw_classifier_json: unknown;
  raw_session_meta: unknown;
};

export type PanelMappingRow = {
  id: number;
  client_handle: string;
  panel_id: string;
  panel_name: string;
  step_id: string;
  step_name: string;
  composite_key: string;
  refreshed_at: string;
};

export type WtsResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

export type Operator = 'Murilo' | 'Lucas';

export type RealtimeStatus = 'CONNECTING' | 'SUBSCRIBED' | 'CLOSED' | 'CHANNEL_ERROR';
