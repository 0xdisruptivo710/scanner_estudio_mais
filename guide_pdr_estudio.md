# `guide_pdr_estudio.md` — Migração / Clonagem para **Estúdio Mais Shopping Taboão**

> **Para o agente (Claude Code / Codex / outro):** este é o **delta-doc** sobre o `guide_pdr.md` canônico. Tudo que **não** está aqui segue idêntico ao `guide_pdr.md` original — leia-o primeiro. Onde houver divergência (banco, nomes de tabela, schema do panel mapping, coluna nova `responsible_user_name`, segredos), **este documento prevalece**.
>
> O objetivo é clonar o repo `aios-scanner-macae` para `aios-scanner-estudio-mais` e fazer ele apontar para **3 tabelas já criadas e populadas** no projeto Supabase compartilhado (`ehlpmukjdknnyhkycncb`). **Não rodar as migrations canônicas** — elas criariam tabelas que não existem nesse cliente. Há um único SQL adicional (uma `CREATE VIEW`) para resolver o mismatch de schema do panel mapping. Está em §A1.

---

## 0. Decisões arquiteturais — leia antes de tudo

| Decisão | Valor | Por quê |
|---|---|---|
| Projeto Supabase | **Compartilhado** com Itupeva e Macaé (`ehlpmukjdknnyhkycncb`) | Já tem o realtime, RLS desligada, índices. Evita criar projeto novo. |
| Isolamento entre clientes | **Tabelas dedicadas com sufixo `_estudio`** (logs/runs) + **VIEW** sobre `wts_panel_mapping_v2` | Mesma estratégia do Macaé (`_macae`). Mantém dados separados sem multiplicar projetos. |
| `wts_panel_mapping_v2` | Tabela **multi-tenant rica** já criada (genérica: armazena steps E tags por `entity_type`) | É o sucessor da `wts_panel_mapping` original. Estúdio populou ela com 12 steps + 90 tags. O Itupeva continua na tabela legada. |
| Tabela esperada pelo app | Schema flat (`panel_name`, `step_id`, `step_name`, `composite_key`) — definido em `src/lib/types.ts:PanelMappingRow` | **Não vamos mudar o app.** Criamos uma VIEW `wts_panel_mapping_estudio` que projeta `wts_panel_mapping_v2` no schema esperado. |
| Coluna nova | `responsible_user_id` + `responsible_user_name` em `wts_auto_followups_logs_estudio` | O scanner do Estúdio grava qual atendente (Hellen, Priscila, Anne Caroline, Fernanda, Beatriz, Ana, Sonária) estava responsável pela sessão. Precisa aparecer na UI. |
| RLS | Desligada nas duas tabelas lidas pelo app | Mesmo tradeoff dos outros clientes — app embutido, URL não compartilhada. |
| Realtime | `wts_auto_followups_logs_estudio` adicionada ao publication `supabase_realtime` (manual, ver §3.3) | Sem isso, sugestões novas só aparecem após "Atualizar". |

### O que **NÃO** fazer neste cliente

- ❌ **Não rodar** as 6 migrations canônicas (`2026-05-11*`) — elas criariam `wts_auto_followup_log` (sem sufixo) que não usamos aqui.
- ❌ **Não rodar** a `2026-05-14_macae_tables_bootstrap.sql` — é específica do Macaé.
- ❌ **Não criar projeto Supabase novo.**
- ❌ **Não tocar** em `wts_panel_mapping_v2` por fora deste cliente (Itupeva legacy lê doutra). Só faça `INSERT` com `client_handle='estudio-mais'`.

---

## 1. Client Variables — diferenças vs Macaé/Itupeva

Tudo nesta tabela é **por cliente**. Os valores do Estúdio Mais já estão preenchidos.

| # | Variável | Onde vive | Valor (Estúdio Mais) | Notas |
|---|---|---|---|---|
| 1 | `CLIENT_HANDLE` | `src/lib/constants.ts:10` | `'estudio-mais'` | Bate com `client_handle` em todas as 3 tabelas Supabase. |
| 2 | `WHATSAPP_FROM` (dígitos) | `src/lib/constants.ts:9` | `'5511XXXXXXXXX'` | **CONFIRMAR com Murilo** — número do WhatsApp Business da clínica. |
| 3 | `WHATSAPP_FROM_FORMATTED` | `src/lib/wts.ts:8` | `'(11) XXXXX-XXXX'` | Idem. Formato exato que a WTS aceita. |
| 4 | `DEFAULT_PANEL_ID` | `src/lib/constants.ts:12` | `'19440e47-cd18-4dbf-8f7b-1dcc1c71205a'` | UUID do "Painel Comercial" do Estúdio (scope DEPARTMENT). |
| 5 | `ALLOWED_PANEL` (nome) | `src/components/drawer/column-select.tsx:11` | `'Painel Comercial'` | Mesmo nome que o Macaé. Bate com `panel_name` na VIEW. |
| 6 | Marca exibida no preview | `src/components/drawer/whatsapp-preview.tsx` | `Estúdio Mais · Shopping Taboão` | Texto livre, só estético. |
| 7 | Catálogo de tags | `src/data/tags-estudio-mais.json` + import em `src/components/drawer/tag-select.tsx:9` | criar a partir de `tags_itupeva_curado.json` | 90 tags coletadas da API WTS. Lista canônica está no §A2 (também acessível via `SELECT entity_name FROM wts_panel_mapping_v2 WHERE client_handle='estudio-mais' AND entity_type='tag'`). |
| 8 | `VITE_SUPABASE_URL` | `.env` + Vercel envs | `https://ehlpmukjdknnyhkycncb.supabase.co` | **Mesmo projeto** do Itupeva/Macaé. |
| 9 | `VITE_SUPABASE_ANON_KEY` | `.env` + Vercel envs | Mesma do Itupeva/Macaé (pegar no Supabase Dashboard) | `anon` key — não confundir com `service_role`. |
| 10 | `WTS_TOKEN_ESTUDIO_MAIS` | Vercel env (server-only) + `api/wts.ts` | `pn_b4hNHg2LW9bMUvidIylwkAAKdmELE4rewWZpqydg` | **Server-only**, sem prefixo `VITE_`. Ver §4. |
| 11 | `VITE_WTS_TOKEN_ESTUDIO_MAIS` (tipo) | `src/vite-env.d.ts:6` | declarar tipo | Manter o tipo em sincronia. Em produção o token nunca é usado no client. |
| 12 | Nome do repo GitHub | GitHub | `aios-inteligence-estudio-mais` (sugerido) | |
| 13 | Nome do projeto Vercel | Vercel | `aios-inteligence-estudio-mais` (sugerido) | Match com o repo. |
| 14 | `TABLE_AUTO_FOLLOWUP_LOG` | `src/lib/constants.ts:16` | `'wts_auto_followups_logs_estudio'` | **Novo nome** — observe o plural em `followups_logs` e o sufixo `_estudio`. |
| 15 | `TABLE_PANEL_MAPPING` | `src/lib/constants.ts:17` | `'wts_panel_mapping_estudio'` (**VIEW**, ver §A1) | A VIEW projeta `wts_panel_mapping_v2` no schema esperado pelo app. |
| 16 | `TABLE_FOLLOWUP_RUNS` | `src/lib/constants.ts:18` | `'wts_auto_followups_runs_estudio'` | |
| 17 | Coluna nova `responsible_user_name` | `src/lib/types.ts:SuggestionRow` + UI | string \| null | Adicionar no type e renderizar (ver §5.3). |

> **Regra de ouro:** se um valor não está nesta tabela ou no `guide_pdr.md` original, **não toque**. O resto do código é idêntico ao Macaé.

---

## 2. Pré-requisitos

Mesmos do `guide_pdr.md` §2, **menos** o item "Conta Supabase com permissão para criar projeto novo" — não precisa, já usamos o projeto existente.

Você precisa ter:

- [ ] Acesso à organização GitHub
- [ ] Acesso à organização Vercel
- [ ] **Acesso de leitura ao projeto Supabase `ehlpmukjdknnyhkycncb`** (anon key + service_role)
- [ ] Token WTS do Estúdio Mais (valor acima, ou regenerar no Aios CRM)
- [ ] WhatsApp Business da clínica (a confirmar)
- [ ] Node ≥ 20, `git`, `npm`, idealmente `vercel` CLI

---

## 3. Banco de dados — o que já existe e o que falta fazer

> **⚠️ NÃO RODE NENHUMA DAS 6 MIGRATIONS CANÔNICAS.** As tabelas para este cliente já foram criadas em 2026-05-15 via MCP Supabase. O resumo está abaixo. A única coisa que falta é a VIEW de panel mapping (§3.1).

### 3.0 Estado atual no Supabase (`ehlpmukjdknnyhkycncb`)

Validar antes de começar:

```sql
SELECT 'wts_auto_followups_logs_estudio' AS table_name, count(*) AS rows
  FROM public.wts_auto_followups_logs_estudio
UNION ALL SELECT 'wts_auto_followups_runs_estudio', count(*)
  FROM public.wts_auto_followups_runs_estudio
UNION ALL SELECT 'wts_panel_mapping_v2 (steps)', count(*)
  FROM public.wts_panel_mapping_v2 WHERE client_handle='estudio-mais' AND entity_type='step'
UNION ALL SELECT 'wts_panel_mapping_v2 (tags)', count(*)
  FROM public.wts_panel_mapping_v2 WHERE client_handle='estudio-mais' AND entity_type='tag';
```

Resultado esperado:

| table_name | rows |
|---|---:|
| wts_auto_followups_logs_estudio | 0 (ou + se o scanner já rodou) |
| wts_auto_followups_runs_estudio | 0 (idem) |
| wts_panel_mapping_v2 (steps) | 12 |
| wts_panel_mapping_v2 (tags) | 90 |

### 3.1 Criar a VIEW `wts_panel_mapping_estudio` (única migration a aplicar)

O hook `usePanelMapping` (`src/hooks/use-panel-mapping.ts`) faz:

```ts
const { data } = await supabase
  .from(TABLE_PANEL_MAPPING)
  .select('*')
  .eq('client_handle', CLIENT_HANDLE);
// espera: { id, client_handle, panel_id, panel_name, step_id, step_name, composite_key, refreshed_at }
```

`wts_panel_mapping_v2` tem nomes diferentes (`panel_title`, `entity_id`, `entity_name`) e armazena também tags. A VIEW filtra só `entity_type='step'` e renomeia as colunas, sem alterar a tabela base.

Aplicar via MCP Supabase ou SQL Editor:

```sql
CREATE OR REPLACE VIEW public.wts_panel_mapping_estudio AS
SELECT
  id,
  client_handle,
  panel_id,
  panel_title  AS panel_name,
  entity_id    AS step_id,
  entity_name  AS step_name,
  (panel_title || ' > ' || entity_name) AS composite_key,
  updated_at   AS refreshed_at
FROM public.wts_panel_mapping_v2
WHERE entity_type = 'step'
  AND client_handle = 'estudio-mais';

COMMENT ON VIEW public.wts_panel_mapping_estudio IS
  'Shim para o app aios-inteligence-estudio-mais. Projeta wts_panel_mapping_v2 no schema esperado por src/lib/types.ts:PanelMappingRow.';
```

**Validar:**

```sql
SELECT panel_name, step_name, composite_key
FROM public.wts_panel_mapping_estudio
ORDER BY step_name;
-- Deve retornar 12 linhas, todas com panel_name = 'Painel Comercial'
```

### 3.2 RLS

`wts_auto_followups_logs_estudio` e `wts_panel_mapping_v2` precisam ter RLS desligada (mesma decisão dos outros clientes). Validar:

```sql
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname IN ('wts_auto_followups_logs_estudio',
                  'wts_auto_followups_runs_estudio',
                  'wts_panel_mapping_v2');
```

Se `relrowsecurity` for `t` em alguma das duas lidas pelo app, rodar:

```sql
ALTER TABLE public.wts_auto_followups_logs_estudio DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.wts_panel_mapping_v2 DISABLE ROW LEVEL SECURITY;
-- Runs pode ficar com RLS habilitada (não é lida do client).
```

### 3.3 Realtime

`wts_auto_followups_logs_estudio` precisa estar no publication `supabase_realtime`. Verificar:

```sql
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename = 'wts_auto_followups_logs_estudio';
```

Se vazio, adicionar:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.wts_auto_followups_logs_estudio;
```

E confirmar no Supabase Dashboard → **Database → Replication** que a tabela está marcada.

### 3.4 Schema das 3 tabelas (referência rápida)

`wts_auto_followups_logs_estudio` tem **as mesmas colunas** que `wts_auto_followup_log_macae`, **mais** `responsible_user_id` e `responsible_user_name`. Lista completa:

```
id, client_handle, session_id, contact_id, customer_name, customer_phone,
responsible_user_id, responsible_user_name,
classified_at, mode, is_followup, suggest_message, confidence, no_history,
current_tag_ids, current_tag_names,
tag_applied, suggested_tag_id, column_applied, suggested_step_id,
card_action, card_id_used,
message_sent, reasoning_short, scenario, error_reason,
raw_classifier_json, raw_session_meta,
human_verdict, action_status, human_message_override,
actioned_by, actioned_at,
wts_tag_applied_at, wts_card_moved_at, wts_message_sent_at, wts_errors
```

Constraints relevantes:
- `id` é `bigserial`, PK
- `client_handle` `NOT NULL DEFAULT 'estudio-mais'` (mas o scanner manda explícito)
- `session_id` `NOT NULL`
- `mode` `NOT NULL` (texto livre — sem CHECK constraint nesta tabela; diferente do Macaé)
- `classified_at` `DEFAULT now()`
- `no_history` `NOT NULL DEFAULT false`

Os índices já existem (8 índices, incluindo um novo `idx_fu_log_estudio_responsible` para queries por atendente).

---

## 4. WTS — token

Mesmo padrão do `guide_pdr.md` §5, **com sufixo trocado**:

1. Env name no Vercel: `WTS_TOKEN_ESTUDIO_MAIS` (server-only, sem prefixo `VITE_`).
2. Atualizar `api/wts.ts`:

   ```ts
   // api/wts.ts:2
   const token = process.env.WTS_TOKEN_ESTUDIO_MAIS
              || process.env.VITE_WTS_TOKEN_ESTUDIO_MAIS;
   ```

3. Atualizar tipo:

   ```ts
   // src/vite-env.d.ts:6
   readonly VITE_WTS_TOKEN_ESTUDIO_MAIS: string;
   ```

> ⚠️ **Atenção ao token deste cliente:** o token tem permissões **mais restritas** que os demais. `GET /core/v1/user` e `GET /crm/v1/step` retornam **401**. Para o app aios-inteligence isso é OK (ele usa `GET /core/v1/tag`, `GET /core/v1/contact/:id`, `GET /crm/v1/panel/card`, `POST /crm/v1/panel/card`, `POST /chat/v1/message/send`, todos no escopo permitido). Se você precisar listar usuários ou steps dinâmicos no futuro, vai precisar regenerar token com escopo maior.

### 4.1 Rate-limit & retry

Mantém do canônico: `WTS_RATE_LIMIT_MS = 700`, `BULK_CONCURRENCY = 5`. **Não mudar.**

---

## 5. Mudanças no código — checklist completa

> Faça **só** as 8 mudanças abaixo. Tudo mais é idêntico ao template Macaé.

### 5.1 `src/lib/constants.ts`

```ts
export const WHATSAPP_FROM = '5511XXXXXXXXX';                            // CONFIRMAR
export const CLIENT_HANDLE = 'estudio-mais';

export const DEFAULT_PANEL_ID = '19440e47-cd18-4dbf-8f7b-1dcc1c71205a';

export const TABLE_AUTO_FOLLOWUP_LOG = 'wts_auto_followups_logs_estudio';
export const TABLE_PANEL_MAPPING = 'wts_panel_mapping_estudio';          // VIEW
export const TABLE_FOLLOWUP_RUNS = 'wts_auto_followups_runs_estudio';
```

`SUPABASE_URL` default pode manter o do template (a env do Vercel sobrescreve).

### 5.2 `src/lib/wts.ts`

```ts
// linha ~8
export const WHATSAPP_FROM_FORMATTED = '(11) XXXXX-XXXX';                // CONFIRMAR
```

### 5.3 `src/lib/types.ts` — adicionar `responsible_user_*` no `SuggestionRow`

```ts
export type SuggestionRow = {
  id: number;
  client_handle: string;
  session_id: string;
  customer_phone: string | null;
  customer_name: string | null;
  contact_id: string | null;

  // ← NOVO neste cliente:
  responsible_user_id: string | null;
  responsible_user_name: string | null;

  classified_at: string;
  // … resto idêntico
};
```

### 5.4 `src/components/drawer/whatsapp-preview.tsx`

Trocar texto da marca (linha ~25) para `Estúdio Mais · Shopping Taboão`.

### 5.5 `src/components/drawer/tag-select.tsx`

```ts
import tagsCurado from '@/data/tags-estudio-mais.json';
```

### 5.6 `src/data/tags-estudio-mais.json`

Criar a partir de `tags_itupeva_curado.json`. Conteúdo: `{ client_handle: 'estudio-mais', categories: { ... } }`. As 90 tags estão listadas em §A2.

**Importante**: existem duplicatas conhecidas no catálogo do WTS (`INDICAÇÃO` × `Indicação ` com espaço, e ~20 tags com whitespace bagunçado). O catálogo curado deve **deduplicar e padronizar**. Sugestão: agrupar em categorias `Fluxo` (Lead Novo, Em Negociação, Agendou, etc.), `Procedimentos faciais`, `Procedimentos corporais`, `Manutenção`, `Operacional` (NÃO ENVIAR, Desqualificado, etc.).

### 5.7 `api/wts.ts` + `src/vite-env.d.ts`

Renomear sufixo da env (§4 acima).

### 5.8 Renderizar `responsible_user_name` na UI

Onde mostrar: na linha do inbox (lista de sugestões), como badge/chip pequeno ao lado do nome do cliente. Sugestão (não obrigatório este formato exato — adaptar ao layout existente):

- Em `src/components/drawer/suggestion-drawer.tsx` (header do drawer): exibir `Atendente: {responsible_user_name ?? '—'}` em texto secundário, abaixo de `customer_name`.
- Em `src/routes/inbox.tsx` (ou onde a lista é renderizada): adicionar uma coluna/badge pequena. Se a tela já está cheia, prioriza o drawer.

Conteúdo do badge quando `null`: hífen (`—`) ou esconder. Quando preenchido: primeiro nome (ex: "Hellen", "Priscila", "Anne Caroline").

Validar com `npm run typecheck` e `npm run build` após cada mudança.

---

## 6. Vercel — deploy

### 6.1 Criar projeto

```bash
vercel login
vercel link                  # ou: vercel projects add aios-inteligence-estudio-mais
```

Framework preset: **Vite**. Output: `dist`. Build: `npm run build`.

### 6.2 Environment Variables

Adicionar em **Production**, **Preview** e **Development**:

| Nome | Escopo | Valor |
|---|---|---|
| `VITE_SUPABASE_URL` | Client | `https://ehlpmukjdknnyhkycncb.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Client | (anon key do projeto compartilhado) |
| `WTS_TOKEN_ESTUDIO_MAIS` | **Server-only** | `pn_b4hNHg2LW9bMUvidIylwkAAKdmELE4rewWZpqydg` |
| `VITE_INFOSOFT_API_BASE` | Client | (vazio — Estúdio Mais não usa Infosoft) |
| `VITE_INFOSOFT_API_TOKEN` | Client | (vazio) |

> ⚠️ **NUNCA** prefixe o token WTS com `VITE_` em produção — isso jogaria o token pro bundle do cliente.

### 6.3 Deploy

```bash
git push origin main         # auto-deploy via integração GitHub
# ou:
vercel deploy --prod
```

---

## 7. Embed no Aios CRM

Idêntico ao §8 do `guide_pdr.md` canônico.

---

## 8. Smoke Test & Handover

Antes de entregar pro cliente, validar os 9 pontos abaixo (8 do canônico + 1 novo para `responsible_user_name`):

| # | Verificação | Como |
|---|---|---|
| 1 | App carrega sem erros | Abrir a URL do Vercel, console limpo |
| 2 | Header mostra "Caixa de Sugestões" e "Ações Aprovadas", botão **Atualizar** funciona | Navegar entre as duas rotas |
| 3 | Inbox lista sugestões pending do `client_handle='estudio-mais'` | `SELECT count(*) FROM wts_auto_followups_logs_estudio WHERE client_handle='estudio-mais' AND action_status='pending'` deve bater com a UI |
| 4 | Drawer abre, mostra dados do cliente + **atendente responsável** | Clicar em uma linha; o nome (Hellen/Priscila/Anne Caroline/etc.) aparece |
| 5 | Dropdown **Coluna** lista as 12 colunas do Painel Comercial | Em conversa, Orçamento em aberto, Agendou avaliação, Desmarcou avaliação, Compareceu, Agendamento realizado, Desmarcou, Faltou, Em protocolo, Pós procedimento, Retornar, Recuperação Cliente |
| 6 | Realtime: inserir uma row de teste com `action_status='pending'` → aparece sem clicar Atualizar | `INSERT INTO wts_auto_followups_logs_estudio (client_handle, session_id, mode, action_status, customer_name, responsible_user_name) VALUES ('estudio-mais','smoke-test-001','shadow','pending','Cliente Smoke','Hellen');` — depois `DELETE` |
| 7 | Aprovar uma sugestão de teste move para "Ações Aprovadas" e dispara WTS sem 401/403 | Conferir `wts_errors` IS NULL na linha aprovada |
| 8 | `/api/wts?p=/core/v1/tag&PageSize=1` retorna 200 com JSON | `curl https://<deploy>.vercel.app/api/wts?p=/core/v1/tag&PageSize=1` |
| 9 | `/api/wts?p=/crm/v1/panel/19440e47-cd18-4dbf-8f7b-1dcc1c71205a` retorna 200 | Validar que o token consegue ler o painel |

### Relatório final do agente — formato sugerido

```
## Provisionamento aios-inteligence-estudio-mais — concluído

**GitHub:** <url>
**Vercel:** <url>
**Supabase:** ehlpmukjdknnyhkycncb (compartilhado)
**Client handle:** estudio-mais

### Variáveis aplicadas
- CLIENT_HANDLE = estudio-mais
- WHATSAPP_FROM = <dígitos confirmados>
- WHATSAPP_FROM_FORMATTED = <formatado confirmado>
- DEFAULT_PANEL_ID = 19440e47-cd18-4dbf-8f7b-1dcc1c71205a
- ALLOWED_PANEL = 'Painel Comercial'
- TABLE_AUTO_FOLLOWUP_LOG = wts_auto_followups_logs_estudio
- TABLE_PANEL_MAPPING = wts_panel_mapping_estudio (VIEW)
- TABLE_FOLLOWUP_RUNS = wts_auto_followups_runs_estudio
- Catálogo: src/data/tags-estudio-mais.json (N categorias, 90 tags)
- Env name WTS = WTS_TOKEN_ESTUDIO_MAIS

### Banco
- [x] Tabelas já existiam (criadas em 2026-05-15 via MCP)
- [x] VIEW wts_panel_mapping_estudio criada
- [x] RLS desligada em wts_auto_followups_logs_estudio e wts_panel_mapping_v2
- [x] Realtime publication confirma wts_auto_followups_logs_estudio

### Schema delta vs Macaé
- [x] Coluna responsible_user_id adicionada ao SuggestionRow
- [x] Coluna responsible_user_name renderizada no drawer

### Smoke test
1–9: [x]

### Pendências
<lista, ou "nenhuma">
```

---

## 9. O que NÃO mudar

Hard-stop. Tudo que está em §10 do `guide_pdr.md` canônico continua valendo, **mais**:

- Schema do banco — qualquer coluna nova vira **uma nova migration**. Nunca editar as tabelas existentes pelo Dashboard.
- A VIEW `wts_panel_mapping_estudio` — se o app começar a precisar de tags dinâmicas vindas do banco, criar uma segunda VIEW `wts_tag_mapping_estudio` filtrando `entity_type='tag'`; **não** mexer na VIEW existente.
- O `client_handle='estudio-mais'` filtro hardcoded na VIEW — se outro cliente migrar pro `wts_panel_mapping_v2`, ele cria a própria VIEW.

---

## 10. Troubleshooting — deltas específicos do Estúdio

Tudo do §11 canônico se aplica, **mais**:

| Sintoma | Causa provável | Fix |
|---|---|---|
| Dropdown Coluna vazio mesmo após seed | A VIEW `wts_panel_mapping_estudio` não foi criada, ou o `client_handle` no filtro está errado | Rodar SQL do §3.1 e validar |
| Dropdown Coluna mostra 0 itens (ou itens estranhos) mas `wts_panel_mapping_v2` tem rows | A VIEW só projeta `entity_type='step'` — se as 12 rows foram inseridas como `entity_type='tag'`, ela não vê | `SELECT entity_type, count(*) FROM wts_panel_mapping_v2 WHERE client_handle='estudio-mais' GROUP BY 1` |
| `usePanelMapping` retorna `composite_key` `null` | A VIEW tem `entity_name IS NULL` em alguma row | `SELECT id, entity_id FROM wts_panel_mapping_v2 WHERE client_handle='estudio-mais' AND entity_type='step' AND entity_name IS NULL` |
| Aprovar dá `step_id_not_found_for:<nome>` | O nome da coluna sugerida pelo classifier não bate exatamente com `step_name` da VIEW | Conferir se o n8n classifier está usando o catálogo correto (`CATALOGO_COLUNAS_GESTOR` do `estudio_mais_followup_classifier.json`) |
| `responsible_user_name` sempre `null` na UI | O scanner não populou no INSERT, ou o `STAFF_MAP` no scanner não tem aquele `userId` | Conferir `estudio_mais_followup_scanner_daily.json` node `Enrich with tags` e log do Validações pós-IA |
| 401 ao consultar `/api/wts?p=/core/v1/user` | Esperado — o token WTS deste cliente não tem permissão `/user` | Não usar esse endpoint. Atendentes vêm de `STAFF_MAP` hardcoded no scanner. |
| 401 ao consultar `/api/wts?p=/crm/v1/step` | Idem | Steps vêm da VIEW `wts_panel_mapping_estudio`, não da API direto |

---

## Anexo A1 — SQL canônico da VIEW (copy/paste pronto)

```sql
CREATE OR REPLACE VIEW public.wts_panel_mapping_estudio AS
SELECT
  id,
  client_handle,
  panel_id,
  panel_title  AS panel_name,
  entity_id    AS step_id,
  entity_name  AS step_name,
  (panel_title || ' > ' || entity_name) AS composite_key,
  updated_at   AS refreshed_at
FROM public.wts_panel_mapping_v2
WHERE entity_type = 'step'
  AND client_handle = 'estudio-mais';

COMMENT ON VIEW public.wts_panel_mapping_estudio IS
  'Shim para o app aios-inteligence-estudio-mais. Projeta wts_panel_mapping_v2 (genérica) no schema esperado por src/lib/types.ts:PanelMappingRow.';
```

## Anexo A2 — Steps do Painel Comercial (referência)

| stepId | step_name | cards atuais |
|---|---|---:|
| `262f75a6-cba4-4f4f-be40-23a99995c56f` | Em conversa | 320 |
| `9fe34edd-31a9-41cb-b571-45477cc48114` | Orçamento em aberto | 90 |
| `61bf6028-5740-420e-9686-e4284fce7b8e` | Agendou avaliação | 127 |
| `d596d8f9-47e6-42fa-bba9-cb470810bea4` | Desmarcou avaliação | 15 |
| `4e73005d-2edd-4baf-bdc0-93901107fd55` | Compareceu | 43 |
| `c69080dc-3ee5-447d-998c-7eaf76936301` | Agendamento realizado | 148 |
| `81e09f46-2b69-44b8-ad35-8002e9aad58c` | Desmarcou | 73 |
| `7b158448-2e57-4fdc-a354-b753e474215a` | Faltou | 3 |
| `b0a92dba-2063-460e-a17a-9233e3ef541f` | Em protocolo | 23 |
| `dce7ee8e-de5b-4f88-b65d-8d4da0b975fc` | Pós procedimento | 19 |
| `d24c5e4e-7c2d-4623-931a-85cce7fc0570` | Retornar | 672 |
| `bfa4317f-f091-491d-b673-56c5138954e3` | Recuperação Cliente | 695 |

> **Diferença vs Macaé:** NÃO existem colunas D1/D2/D3/D4 escalonadas. O funil de resgate é `Retornar` → `Recuperação Cliente`. Mantenha esse fato em mente ao revisar prompts ou validar saídas do classifier.

## Anexo A3 — Atendentes (STAFF_MAP do scanner)

Lista hardcoded no scanner n8n. Pode aparecer na coluna `responsible_user_name` da tabela de logs.

| userId WTS | nome inferido | profile (WTS) | observações |
|---|---|---|---|
| `fa923a10-e2c4-42cf-a4b7-39f1fb8e0d08` | Hellen Oliveira | Administrador | atendente top (821 sessões/30d) |
| `38c1dc95-3233-4d04-b9c5-851666561c1b` | Priscila Leite | Atendente | |
| `996cb83c-b1e6-4057-a51c-d2a75eef02ba` | Anne Caroline | Atendente | |
| `5b03eb54-87a9-443e-9ccb-627c4518c20b` | Fernanda Leal | Atendente | |
| `54e2325c-89d7-4c2b-a500-5e5e5861f263` | Doutora Ana Torres | Atendente | atende clientes também |
| `d88606e3-e811-448b-9391-e8794cb3d05a` | Beatriz | Administrador | atende |
| `fc9eb8e1-35df-4ecc-81fd-7e330066c4a5` | Admin Painel | — | criador do painel; gerência |
| `b95dc2ee-9f76-4a7d-ba00-417b8763fcf0` | Sistema/Transferência | — | sem prefixo de nome nas msgs |
| `ac0fcc2e-7ad0-4701-896f-346952248de0` | Admin Residual | — | 1 sessão histórica |

Sonária Pereira Lima é atendente (perfil Atendente no WTS) mas ainda não tem userId rastreado em sessões dos últimos 30 dias. Quando aparecer pela primeira vez, vai cair como `responsible_user_name = null` até o `STAFF_MAP` ser atualizado.

---

## 11. Referências

- `guide_pdr.md` — documento canônico. Este aqui é **delta**.
- `wts-api-reference.md` — endpoints WTS.
- `migrations/2026-05-14_macae_tables_bootstrap.sql` — template estrutural das tabelas (Macaé). Não rodar neste cliente; usar como referência de schema apenas.
- n8n scanner: `clientes/estúdio-mais-shopping-taboão/n8n/estudio_mais_followup_scanner_daily.json` (segundo cérebro do Murilo) — produz as rows que o app aios-inteligence lê.
- n8n classifier: `clientes/estúdio-mais-shopping-taboão/n8n/estudio_mais_followup_classifier.json`.
- Discovery WTS: `clientes/estúdio-mais-shopping-taboão/n8n/_discovery.md` — fonte de verdade dos UUIDs (panel/step/tag).

---

**Última revisão:** 2026-05-15
