import { cn } from "@/lib/cn";
import { useT } from "@/lib/vaani/i18n";

export function StatusPill({ status }: { status: string }) {
  const { status: label } = useT();
  const map: Record<string, string> = {
    pending: "text-warn border-line",
    sent: "text-accent border-line",
    reviewing: "text-accent border-line",
    quoted: "text-accent border-line",
    accepted: "text-ok border-line",
    confirmed: "text-ok border-line",
    finalized: "text-ok border-line",
    delivered: "text-ok border-line",
    rejected: "text-danger border-line",
    order: "text-ink border-line",
    inquiry: "text-muted border-line",
    draft: "text-muted border-line",
  };
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-full border bg-surface px-2.5 text-[11px] font-medium tracking-wide",
        map[status] ?? "text-muted border-line",
      )}
    >
      {label(status)}
    </span>
  );
}
