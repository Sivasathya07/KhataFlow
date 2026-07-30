import { ArrowUpRight, Package, WalletCards } from "lucide-react";
import { Card } from "@/components/ui/card";

type Metric = {
  label: string;
  value: string;
  change: string;
  tone: "emerald" | "violet" | "sky" | "amber";
};

const styles: Record<Metric["tone"], { icon: string; change: string }> = {
  emerald: { icon: "bg-emerald-50 text-emerald-600", change: "text-emerald-700" },
  violet: { icon: "bg-[var(--accent-soft)] text-[var(--accent-strong)]", change: "text-[var(--accent-strong)]" },
  sky:    { icon: "bg-sky-50 text-sky-600",     change: "text-sky-700" },
  amber:  { icon: "bg-amber-50 text-amber-600", change: "text-amber-700" },
};

export function MetricCard({ metric, index }: { metric: Metric; index: number }) {
  const Icon = index === 2 ? Package : index === 3 ? WalletCards : ArrowUpRight;
  const s = styles[metric.tone];
  return (
    <Card className="surface-panel p-5 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-[var(--muted)]">{metric.label}</p>
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${s.icon}`}>
          <Icon size={18} />
        </span>
      </div>
      <p className="mt-4 font-display text-2xl tracking-tight text-[var(--ink)]">{metric.value}</p>
      <p className={`mt-1.5 text-xs font-semibold ${s.change}`}>{metric.change}</p>
    </Card>
  );
}
