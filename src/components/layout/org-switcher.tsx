"use client";

import Link from "next/link";
import { Building2, Check, ChevronDown, Plus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Compact organization switcher for the header. Shows the active org
 * name with a chevron; clicking it opens a list of the user's orgs and
 * a "Create new organization" entry.
 *
 * Renders nothing while orgs are loading (avoids a flash of empty
 * state) or when the user has no orgs (the middleware should have
 * already redirected them to onboarding in that case).
 */
export function OrgSwitcher() {
  const { orgs, activeOrgId, orgsLoading, switchOrg } = useAuth();

  if (orgsLoading || orgs.length === 0) return null;

  const active = orgs.find((o) => o.id === activeOrgId) ?? orgs[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Switch organization"
        className="flex max-w-[180px] items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent focus:bg-accent focus:outline-none data-popup-open:bg-accent sm:max-w-[220px]"
      >
        <Building2 className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{active.name}</span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className="min-w-56">
        <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Organizations
        </div>
        {orgs.map((o) => {
          const isActive = o.id === active.id;
          return (
            <DropdownMenuItem
              key={o.id}
              onClick={() => switchOrg(o.id)}
              aria-current={isActive ? "true" : undefined}
              className="flex items-center justify-between gap-2"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Building2 className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{o.name}</span>
              </span>
              {isActive ? (
                <Check className="size-4 shrink-0 text-primary" />
              ) : (
                <span className="size-4" />
              )}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/onboarding/create-org" />}>
          <Plus className="size-4" />
          Create new organization
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
