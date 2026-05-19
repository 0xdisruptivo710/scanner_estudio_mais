import { useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SuggestionRow } from '@/lib/types';

export const ALL_ATTENDANTS = '__all__';
export const NO_ATTENDANT = '__none__';

export function AttendantSelect({
  rows,
  value,
  onChange,
}: {
  rows: SuggestionRow[];
  value: string;
  onChange: (v: string) => void;
}) {
  const { names, hasUnassigned } = useMemo(() => {
    const set = new Set<string>();
    let unassigned = false;
    for (const row of rows) {
      const name = row.responsible_user_name?.trim();
      if (name) set.add(name);
      else unassigned = true;
    }
    return {
      names: Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR')),
      hasUnassigned: unassigned,
    };
  }, [rows]);

  return (
    <div className="flex items-center gap-2">
      <span className="text-[12.5px] text-muted-foreground">Atendente</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-[320px]">
          <SelectItem value={ALL_ATTENDANTS}>Todos</SelectItem>
          {names.map((name) => (
            <SelectItem key={name} value={name}>
              {name}
            </SelectItem>
          ))}
          {hasUnassigned && (
            <SelectItem value={NO_ATTENDANT}>Sem atendente</SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
