import { cn } from "@/lib/utils";

/**
 * Drwintech brand mark — a rounded emerald→teal monogram. Reused by
 * the sidebar and the auth screens so the identity stays consistent.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[oklch(0.7_0.12_195)] text-primary-foreground shadow-card",
        className,
      )}
    >
      <span className="font-heading text-[0.95em] font-extrabold leading-none">
        D
      </span>
    </span>
  );
}

export function Brand({
  className,
  markClassName,
  wordmarkClassName,
}: {
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <BrandMark className={cn("h-8 w-8 text-base", markClassName)} />
      <span
        className={cn(
          "font-heading text-base font-bold tracking-tight text-foreground",
          wordmarkClassName,
        )}
      >
        Drwintech
      </span>
    </span>
  );
}
