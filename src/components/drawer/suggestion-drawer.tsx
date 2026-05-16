import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ExternalLink } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ScenarioBadge } from '@/components/table/scenario-badge';
import { TypeBadge } from '@/components/table/type-badge';
import { TagSelect } from './tag-select';
import { ColumnSelect } from './column-select';
import { MessageEditor } from './message-editor';
import { WhatsappPreview } from './whatsapp-preview';
import { DrawerActions } from './drawer-actions';
import { useApprove } from '@/hooks/use-approve';
import { useReject } from '@/hooks/use-reject';
import { usePanelMapping } from '@/hooks/use-panel-mapping';
import { useTagsCatalog } from '@/hooks/use-tags-catalog';
import { anonymizePhone, formatDateTime, formatRelativeTime } from '@/lib/format';
import { validateMessage } from '@/lib/validation';
import { cn } from '@/lib/utils';
import type { SuggestionRow, WtsErrorEntry } from '@/lib/types';

type Props = {
  row: SuggestionRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  readOnly?: boolean;
};

export function SuggestionDrawer({ row, open, onOpenChange, readOnly }: Props) {
  const approve = useApprove();
  const reject = useReject();
  const { data: mapping } = usePanelMapping();
  const { data: tagsCatalog } = useTagsCatalog();

  const [tag, setTag] = useState<string | null>(null);
  const [column, setColumn] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!row) return;
    setTag(row.tag_applied);
    setColumn(row.column_applied);
    setMessage(row.human_message_override ?? row.message_sent ?? '');
  }, [row?.id]);

  const validation = useMemo(() => validateMessage(message), [message]);

  if (!row) return null;

  const overrideTag = tag !== row.tag_applied;
  const overrideColumn = column !== row.column_applied;
  const overrideMessage = message !== (row.message_sent ?? '');

  const approveDisabled =
    (row.suggest_message ? !validation.valid : false) || !!readOnly;

  const handleApprove = async () => {
    const effective: SuggestionRow = {
      ...row,
      tag_applied: tag,
      column_applied: column,
    };
    const out = await approve.mutateAsync({
      row: effective,
      override: overrideMessage ? validation.cleaned : null,
      mapping: mapping?.byKey,
      tagsCatalog,
    });
    if (out.status === 'executed') {
      toast.success('Aprovado', {
        description: row.suggest_message
          ? 'Tag, card e mensagem disparados.'
          : 'Tag aplicada e card atualizado.',
      });
      onOpenChange(false);
    } else {
      const errSummary = Object.entries(out.errors)
        .filter(([, v]) => !(v as WtsErrorEntry).ok)
        .map(([k, v]) => `${k}: ${(v as WtsErrorEntry).error}`)
        .join(' · ');
      toast.error('Falha ao aprovar', { description: errSummary || 'Veja wts_errors.' });
    }
  };

  const handleReject = async () => {
    await reject.mutateAsync(row);
    toast('Sugestão rejeitada');
    onOpenChange(false);
  };

  const busy = approve.isPending || reject.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-background">
        <SheetHeader className="bg-surface">
          <div className="flex items-center gap-2">
            <TypeBadge suggestMessage={row.suggest_message} />
            <ScenarioBadge scenario={row.scenario} />
          </div>
          <SheetTitle>{row.customer_name ?? 'Cliente sem nome'}</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono text-subtle-foreground">
              {anonymizePhone(row.customer_phone)}
            </span>
            <span className="text-subtle-foreground/60">·</span>
            <span>{formatRelativeTime(row.classified_at)} atrás</span>
            <span className="text-subtle-foreground/60">·</span>
            <span className="font-mono text-subtle-foreground">
              {row.session_id.slice(0, 8)}…
            </span>
          </SheetDescription>
          <p className="text-[12px] text-subtle-foreground">
            Atendente:{' '}
            <span className="font-medium text-foreground">
              {row.responsible_user_name ?? '—'}
            </span>
          </p>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto bg-background px-6 py-6">
          {row.reasoning_short && (
            <Card>
              <SectionLabel>Razão da IA</SectionLabel>
              <p className="text-[14px] leading-relaxed text-foreground">
                {row.reasoning_short}
              </p>
              <p className="mt-3 font-mono text-[11px] text-subtle-foreground">
                Classificado em {formatDateTime(row.classified_at)}
              </p>
            </Card>
          )}

          <Card>
            <SectionLabel>Ação sugerida</SectionLabel>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Labeled label="Tag" override={overrideTag}>
                <TagSelect value={tag} onChange={setTag} disabled={readOnly} />
              </Labeled>
              <Labeled label="Coluna" override={overrideColumn}>
                <ColumnSelect value={column} onChange={setColumn} disabled={readOnly} />
              </Labeled>
            </div>
          </Card>

          {row.suggest_message ? (
            <>
              <Card>
                <div className="mb-3 flex items-baseline justify-between gap-2">
                  <SectionLabel className="mb-0">Mensagem</SectionLabel>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium',
                      overrideMessage
                        ? 'bg-primary-soft text-primary-soft-foreground'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {overrideMessage ? 'editada por humano' : 'sugerida pela IA'}
                  </span>
                </div>
                <MessageEditor value={message} onChange={setMessage} disabled={readOnly} />
              </Card>

              <Card>
                <SectionLabel>Preview no WhatsApp</SectionLabel>
                <WhatsappPreview text={validation.cleaned} />
              </Card>
            </>
          ) : (
            <Card>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                IA não sugere envio de mensagem. Aprovação aplica apenas{' '}
                <span className="font-medium text-foreground">tag</span> e move/cria o{' '}
                <span className="font-medium text-foreground">card</span>.
              </p>
            </Card>
          )}

          {row.wts_errors && readOnly && (
            <Card>
              <SectionLabel>Erros WTS</SectionLabel>
              <pre className="overflow-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed text-destructive">
                {JSON.stringify(row.wts_errors, null, 2)}
              </pre>
            </Card>
          )}

          <a
            href={`https://app.aioscrm.com/redirect?type=SESSION&id=${row.session_id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-primary hover:underline"
          >
            Abrir conversa no Aios <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <SheetFooter>
          <DrawerActions
            busy={busy}
            approveDisabled={approveDisabled}
            approveLabel={row.suggest_message ? 'Aprovar e enviar' : 'Aplicar tag e mover card'}
            onApprove={handleApprove}
            onReject={handleReject}
            onCancel={() => onOpenChange(false)}
            readOnly={readOnly}
          />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/* AIOS-style card: white, 12px radius, 0.5px border, 20-22px padding. */
function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface px-[22px] py-5 shadow-card">
      {children}
    </section>
  );
}

function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h3
      className={cn(
        'mb-2.5 text-[11px] font-medium uppercase tracking-[0.05em] text-subtle-foreground',
        className,
      )}
    >
      {children}
    </h3>
  );
}

function Labeled({
  label,
  override,
  children,
}: {
  label: string;
  override?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline gap-2 text-[12px] text-muted-foreground">
        {label}
        {override && (
          <span className="rounded-full bg-primary-soft px-1.5 py-0.5 font-mono text-[9px] text-primary-soft-foreground">
            editado
          </span>
        )}
      </span>
      {children}
    </label>
  );
}
