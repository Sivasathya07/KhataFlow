import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";

import { Card } from "@/components/ui/card";

type Props = { title: string; description: string; icon: LucideIcon; tone: "violet" | "sky" | "amber"; onClick?: () => void };

const styles = {
  violet: "from-violet-600 to-indigo-600 shadow-violet-200",
  sky: "from-sky-500 to-cyan-500 shadow-sky-200",
  amber: "from-amber-400 to-orange-500 shadow-amber-200",
};

export function AiActionCard({ title, description, icon: Icon, tone, onClick }: Props) {
  return (
    <button type="button" onClick={onClick} className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2">
    <Card className={`group relative overflow-hidden border-0 bg-gradient-to-br p-5 text-white shadow-lg ${styles[tone]}`}>
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 transition-transform duration-300 group-hover:scale-125" />
      <div className="relative flex min-h-36 flex-col justify-between"><span className="grid h-11 w-11 place-items-center rounded-xl bg-white/15 backdrop-blur"><Icon size={22} /></span><div><div className="flex items-center justify-between"><h3 className="font-semibold">{title}</h3><ArrowUpRight size={18} /></div><p className="mt-1 text-sm text-white/80">{description}</p></div></div>
    </Card>
    </button>
  );
}
