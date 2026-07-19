import { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Tone = "success" | "error" | "neutral" | "pending";

const toneClasses: Record<Tone, string> = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  error: "bg-red-50 text-red-700 ring-red-600/20",
  neutral: "bg-gray-100 text-gray-700 ring-gray-500/20",
  pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
};

export function Badge({ tone = "neutral", className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
