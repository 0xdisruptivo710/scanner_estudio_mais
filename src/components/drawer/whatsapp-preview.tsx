import { CheckCheck } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/*
 * Authentic WhatsApp visual cues — beige chat wallpaper, true "outgoing"
 * green bubble (#D9FDD3 from WhatsApp Web), the double-check ticks WTS sends.
 */
export function WhatsappPreview({ text }: { text: string }) {
  const now = format(new Date(), 'HH:mm', { locale: ptBR });
  return (
    <div
      className="relative overflow-hidden rounded-xl border border-border p-5"
      style={{
        background:
          'repeating-linear-gradient(135deg, #ECE5DD 0 28px, #E6DED3 28px 56px)',
      }}
    >
      <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/85 px-2.5 py-0.5 text-[10.5px] font-medium text-[#4A4A4A] shadow-sm">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: '#25D366' }}
          aria-hidden
        />
        Estúdio Mais · Shopping Taboão
      </div>

      <div className="flex justify-end">
        <div
          className="relative max-w-[88%] rounded-[10px] rounded-tr-[2px] px-3 py-2 text-[13.5px] leading-snug text-[#111B21] shadow-[0_1px_0.5px_rgb(11_20_26/0.13)]"
          style={{ background: '#D9FDD3' }}
        >
          <div className="whitespace-pre-wrap">{text || '—'}</div>
          <div className="mt-1 flex items-center justify-end gap-1 text-[10.5px] text-[#667781]">
            {now}
            <CheckCheck className="h-3.5 w-3.5" style={{ color: '#53BDEB' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
