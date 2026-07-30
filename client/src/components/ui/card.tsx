import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-2xl border border-[var(--line)] bg-[var(--panel)] text-[var(--ink)] shadow-sm", className)}
      {...props}
    />
  );
}
