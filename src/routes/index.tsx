import { useMemo, useState } from 'react';
import { createRoute } from '@tanstack/react-router';
import { Clock3 } from 'lucide-react';
import { toast } from 'sonner';
import { Route as rootRoute } from './__root';
import { FilterTabs, type FilterKey } from '@/components/layout/filter-tabs';
import {
  AttendantSelect,
  ALL_ATTENDANTS,
  NO_ATTENDANT,
} from '@/components/layout/attendant-select';
import { SuggestionsTable } from '@/components/table/suggestions-table';
import { BulkActionBar } from '@/components/layout/bulk-action-bar';
import { SuggestionDrawer } from '@/components/drawer/suggestion-drawer';
import { useSuggestions } from '@/hooks/use-suggestions';
import { usePanelMapping } from '@/hooks/use-panel-mapping';
import { useBulkApprove } from '@/hooks/use-approve';
import { useReject } from '@/hooks/use-reject';
import { useApprove } from '@/hooks/use-approve';
import { useTagsCatalog } from '@/hooks/use-tags-catalog';
import type { SuggestionRow } from '@/lib/types';

function InboxPage() {
  const suggestions = useSuggestions();
  const { data: mapping } = usePanelMapping();
  const { data: tagsCatalog } = useTagsCatalog();
  const bulkApprove = useBulkApprove();
  const reject = useReject();
  const approve = useApprove();

  const [filter, setFilter] = useState<FilterKey>('all');
  const [attendant, setAttendant] = useState<string>(ALL_ATTENDANTS);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [openRow, setOpenRow] = useState<SuggestionRow | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const rows = suggestions.data ?? [];

  const counts = useMemo(
    () => ({
      all: rows.length,
      msg: rows.filter((r) => r.suggest_message).length,
      tag: rows.filter((r) => !r.suggest_message).length,
      cold: rows.filter(
        (r) => r.scenario === 'tag_only_no_engagement' || r.tag_applied === 'NÃO RESPONDE',
      ).length,
    }),
    [rows],
  );

  const filtered = useMemo(() => {
    let out = rows;
    if (attendant === NO_ATTENDANT) {
      out = out.filter((row) => !row.responsible_user_name?.trim());
    } else if (attendant !== ALL_ATTENDANTS) {
      out = out.filter((row) => row.responsible_user_name?.trim() === attendant);
    }
    if (filter === 'msg') return out.filter((row) => row.suggest_message);
    if (filter === 'tag') return out.filter((row) => !row.suggest_message);
    if (filter === 'cold')
      return out.filter(
        (row) =>
          row.scenario === 'tag_only_no_engagement' || row.tag_applied === 'NÃO RESPONDE',
      );
    return out;
  }, [rows, filter, attendant]);

  const handleAttendantChange = (v: string) => {
    setAttendant(v);
    setSelected(new Set());
  };

  const selectedRows = useMemo(
    () => filtered.filter((r) => selected.has(r.id)),
    [filtered, selected],
  );

  const handleBulkApprove = async () => {
    if (selectedRows.length === 0) return;
    setProgress({ done: 0, total: selectedRows.length });
    try {
      const out = await bulkApprove.mutateAsync({
        rows: selectedRows,
        mapping: mapping?.byKey,
        tagsCatalog,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      const ok = out.filter((o) => o.status === 'executed').length;
      const fail = out.length - ok;
      if (fail === 0) toast.success(`${ok} aprovadas`);
      else toast.warning(`${ok} aprovadas · ${fail} falharam`);
      setSelected(new Set());
    } finally {
      setProgress(null);
    }
  };

  const handleBulkReject = async () => {
    if (selectedRows.length === 0) return;
    await reject.mutateAsync(selectedRows);
    toast(`${selectedRows.length} rejeitadas`);
    setSelected(new Set());
  };

  const handleQuickApprove = async (row: SuggestionRow) => {
    const out = await approve.mutateAsync({ row, mapping: mapping?.byKey, tagsCatalog });
    if (out.status === 'executed') toast.success('Aprovado');
    else toast.error('Falha ao aprovar');
  };

  const handleQuickReject = async (row: SuggestionRow) => {
    await reject.mutateAsync(row);
    toast('Rejeitado');
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-3">
          <h1 className="text-[22px] font-medium leading-tight tracking-[-0.015em] text-foreground">
            Caixa de Sugestões
          </h1>
          <ScheduleNotice />
        </div>
        <div className="flex items-baseline gap-1.5 text-[12.5px] text-muted-foreground">
          <span className="font-mono text-foreground">{filtered.length}</span>
          <span>de</span>
          <span className="font-mono">{rows.length}</span>
          <span>visíveis</span>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterTabs filter={filter} onFilterChange={setFilter} counts={counts} />
        <AttendantSelect
          rows={rows}
          value={attendant}
          onChange={handleAttendantChange}
        />
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
        <SuggestionsTable
          rows={filtered}
          loading={suggestions.isLoading}
          selected={selected}
          onSelectChange={setSelected}
          onRowClick={(r) => setOpenRow(r)}
          onQuickApprove={handleQuickApprove}
          onQuickReject={handleQuickReject}
        />
      </section>

      <BulkActionBar
        selectedCount={selectedRows.length}
        busy={bulkApprove.isPending || reject.isPending}
        progress={progress}
        onApprove={handleBulkApprove}
        onReject={handleBulkReject}
        onClear={() => setSelected(new Set())}
      />

      <SuggestionDrawer
        row={openRow}
        open={!!openRow}
        onOpenChange={(o) => !o && setOpenRow(null)}
      />
    </div>
  );
}

function ScheduleNotice() {
  return (
    <p className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full bg-primary-soft/70 py-1 pl-2 pr-3 text-[12px] text-primary-soft-foreground">
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-surface text-primary">
        <Clock3 className="h-3 w-3" />
      </span>
      Sugestões atualizadas todos os dias às{' '}
      <span className="font-mono font-medium">09h</span>
      <span aria-hidden className="text-primary/40">
        ·
      </span>
      tempo médio de <span className="font-mono font-medium">30 min</span> para execução.
    </p>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: InboxPage,
});
