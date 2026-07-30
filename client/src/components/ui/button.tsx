import { Slot } from "@radix-ui/react-slot";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  variant?: "default" | "outline" | "destructive" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
};

export function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";

  const variants = {
    default:
      "bg-[var(--ink)] text-[var(--paper)] hover:opacity-90",
    outline:
      "border border-[var(--line)] bg-[var(--panel)] text-[var(--ink)] hover:bg-[var(--panel-hover)] hover:border-[var(--accent)]",
    destructive:
      "bg-rose-600 text-white hover:bg-rose-700",
    ghost:
      "text-[var(--ink)] hover:bg-[var(--panel-hover)]",
  };

  const sizes = {
    default: "h-10 px-4",
    sm: "h-8 px-3 text-xs",
    lg: "h-11 px-6",
    icon: "h-10 w-10 px-0",
  };

  return (
    <Component
      className={cn(
        "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
