import { useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import tagsCurado from '@/data/tags-estudio-mais.json';

type Curado = {
  categories: Record<string, { label: string; tags: string[] }>;
};

export function TagSelect({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  disabled?: boolean;
}) {
  const groups = useMemo(() => {
    const data = tagsCurado as Curado;
    return Object.entries(data.categories).map(([key, group]) => ({
      key,
      label: group.label,
      tags: group.tags,
    }));
  }, []);

  return (
    <Select value={value ?? undefined} onValueChange={(v) => onChange(v || null)} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder="Sem tag" />
      </SelectTrigger>
      <SelectContent className="max-h-[320px]">
        {groups.map((g) => (
          <div key={g.key} className="px-2 py-1">
            <div className="px-1 pb-1 text-[10px] font-medium uppercase tracking-[0.05em] text-subtle-foreground">
              {g.label}
            </div>
            {g.tags.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </div>
        ))}
      </SelectContent>
    </Select>
  );
}
