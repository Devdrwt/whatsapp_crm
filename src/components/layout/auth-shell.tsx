import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/layout/brand";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Shared visual frame for the auth screens (login / signup / forgot).
 * Light-first centered card on a softly glowing emerald backdrop, with
 * the Drwintech brand. Adapts to dark mode via the design tokens.
 */
export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-12%] h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-primary/15 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[-18%] right-[8%] h-72 w-72 rounded-full bg-[oklch(0.7_0.12_195)]/15 blur-[120px]"
      />
      <Card className="relative w-full max-w-md border-border bg-card shadow-elevate">
        <CardHeader className="items-center text-center">
          <Link
            href="/login"
            aria-label="Drwintech"
            className="mb-3 flex flex-col items-center gap-2"
          >
            <BrandMark className="h-12 w-12 text-xl" />
            <span className="font-heading text-lg font-bold tracking-tight text-foreground">
              Drwintech
            </span>
          </Link>
          <CardTitle className="text-xl text-foreground">{title}</CardTitle>
          <CardDescription className="text-muted-foreground">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}
