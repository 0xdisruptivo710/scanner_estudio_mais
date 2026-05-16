import { WTS_BASE } from './constants';
import type { WtsResult } from './types';

/**
 * WhatsApp `from` number formatado conforme a WTS espera no /chat/v1/message/send.
 * Estúdio Mais: "(11) 95688-3655" (não "5511956883655").
 */
export const WHATSAPP_FROM_FORMATTED = '(11) 95688-3655';

/**
 * Normaliza um telefone pro formato pipe que a WTS retorna e aceita:
 *   "+55|11912345678"
 * Aceita entrada em qualquer formato (com/sem 55, com/sem +, com pipe).
 */
export function toPipePhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (!digits) return input;
  const local = digits.startsWith('55') ? digits.slice(2) : digits;
  return `+55|${local}`;
}

async function wtsFetch<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  contentType: 'application/json' | 'application/*+json' = 'application/json',
): Promise<WtsResult<T>> {
  // Proxy URL: /api/wts?p=<wts-pathname>&<wts-query>
  const [wtsPathname, wtsQuery] = path.split('?', 2);
  const params = new URLSearchParams();
  params.set('p', wtsPathname ?? '');
  if (wtsQuery) {
    const wtsParams = new URLSearchParams(wtsQuery);
    wtsParams.forEach((v, k) => params.append(k, v));
  }
  const proxyUrl = `${WTS_BASE}?${params.toString()}`;

  try {
    const res = await fetch(proxyUrl, {
      method,
      headers: {
        accept: 'application/json',
        ...(body ? { 'content-type': contentType } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    if (!res.ok) {
      const errMsg =
        (parsed && typeof parsed === 'object' && 'message' in parsed
          ? String((parsed as { message: unknown }).message)
          : null) ?? (typeof parsed === 'string' ? parsed : `HTTP ${res.status}`);
      return { ok: false, status: res.status, error: errMsg };
    }

    return { ok: true, data: (parsed as T) ?? (null as unknown as T) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'network_error';
    return { ok: false, status: 0, error: msg };
  }
}

// ============================================================================
// Contact + tags
// ============================================================================

export type WtsContact = {
  id: string;
  name?: string;
  nameWhatsapp?: string;
  phoneNumber?: string;
  tagIds?: string[];
  tagNames?: string[];
};

export type WtsTag = {
  id: string;
  name: string;
  bgColor?: string;
  textColor?: string;
};

export async function wtsListTags(): Promise<WtsResult<WtsTag[]>> {
  // GET /core/v1/tag retorna ARRAY NU (não envelopado em items).
  const res = await wtsFetch<WtsTag[] | { items: WtsTag[] }>('GET', '/core/v1/tag?PageSize=200');
  if (!res.ok) return res;
  const raw = res.data;
  const items = Array.isArray(raw) ? raw : (raw?.items ?? []);
  return { ok: true, data: items };
}

export async function wtsGetContactByPhone(phone: string): Promise<WtsResult<WtsContact>> {
  const p = encodeURIComponent(toPipePhone(phone));
  return wtsFetch('GET', `/core/v1/contact/phonenumber/${p}`);
}

export async function wtsGetContactById(contactId: string): Promise<WtsResult<WtsContact>> {
  return wtsFetch('GET', `/core/v1/contact/${encodeURIComponent(contactId)}`);
}

/**
 * Aplica (insert) UMA OU MAIS tags por UUID em um contato.
 * Body conforme curl oficial:
 *   { "tagIds": ["uuid"] }   -> aplica
 *   { "tagIds": ["uuid"], "operation": "DeleteIfExists" } -> remove
 *
 * O default "InsertIfNotExists" é assumido pelo servidor quando operation é omitido.
 */
export async function wtsApplyTagById(phone: string, tagId: string): Promise<WtsResult> {
  const p = encodeURIComponent(toPipePhone(phone));
  return wtsFetch(
    'POST',
    `/core/v1/contact/phonenumber/${p}/tags`,
    { tagIds: [tagId] },
    'application/*+json',
  );
}

export async function wtsDeleteTagById(phone: string, tagId: string): Promise<WtsResult> {
  const p = encodeURIComponent(toPipePhone(phone));
  return wtsFetch(
    'POST',
    `/core/v1/contact/phonenumber/${p}/tags`,
    { tagIds: [tagId], operation: 'DeleteIfExists' },
    'application/json',
  );
}

// ============================================================================
// Cards (CRM)
// ============================================================================

export type WtsCard = {
  id: string;
  contactId?: string;
  stepId?: string;
  panelId?: string;
};

export async function wtsGetCards(
  panelId: string,
  contactId: string,
): Promise<WtsResult<WtsCard[]>> {
  const qs = new URLSearchParams({
    PanelId: panelId,
    ContactId: contactId,
    PageSize: '5',
  });
  const res = await wtsFetch<{ items?: WtsCard[] } | WtsCard[]>(
    'GET',
    `/crm/v1/panel/card?${qs.toString()}`,
  );
  if (!res.ok) return res;
  const raw = res.data;
  const items = Array.isArray(raw) ? raw : (raw?.items ?? []);
  return { ok: true, data: items };
}

/**
 * Move um card para outra etapa.
 * Curl oficial:
 *   PUT /crm/v2/panel/card/{card_id}
 *   { "fields": ["StepId"], "stepId": "..." }
 *   content-type: application/*+json
 */
export async function wtsMoveCard(cardId: string, stepId: string): Promise<WtsResult> {
  return wtsFetch(
    'PUT',
    `/crm/v2/panel/card/${encodeURIComponent(cardId)}`,
    { fields: ['StepId'], stepId },
    'application/*+json',
  );
}

/**
 * Cria um novo card.
 * Curl oficial:
 *   POST /crm/v1/panel/card
 *   { stepId, title, contactIds: [], sessionId? }
 *   content-type: application/json
 */
export async function wtsCreateCard(args: {
  stepId: string;
  title: string;
  contactId: string;
  sessionId?: string | null;
}): Promise<WtsResult<{ id: string }>> {
  const body: Record<string, unknown> = {
    stepId: args.stepId,
    title: args.title,
    contactIds: [args.contactId],
  };
  if (args.sessionId) body.sessionId = args.sessionId;
  return wtsFetch('POST', '/crm/v1/panel/card', body, 'application/json');
}

// ============================================================================
// Messages
// ============================================================================

/**
 * Envia mensagem de texto pelo WhatsApp.
 * Curl oficial:
 *   POST /chat/v1/message/send
 *   { body: { text }, from: "(11) 91335-2918", to: "+55|11..." }
 *   content-type: application/*+json
 */
export async function wtsSendMessage(phone: string, text: string): Promise<WtsResult> {
  return wtsFetch(
    'POST',
    '/chat/v1/message/send',
    {
      body: { text },
      from: WHATSAPP_FROM_FORMATTED,
      to: toPipePhone(phone),
    },
    'application/*+json',
  );
}

// ============================================================================
// Sessions (raramente usado — fallback se contact_id estiver vazio)
// ============================================================================

export async function wtsGetSession(
  sessionId: string,
): Promise<WtsResult<{ id: string; contactId: string; title?: string | null }>> {
  return wtsFetch('GET', `/chat/v2/session/${encodeURIComponent(sessionId)}`);
}
