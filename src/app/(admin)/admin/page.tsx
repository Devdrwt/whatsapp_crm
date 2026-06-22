import { getTranslations, getLocale } from "next-intl/server";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { AdminOrgsTable, type AdminOrgRow } from "@/components/admin/orgs-table";

/**
 * Super-admin home. Renders a 4-card stats strip and the orgs
 * table. Server component — every query relies on the SELECT RLS
 * policies added in migration 019 to expose cross-org data to the
 * authenticated super-admin only.
 */
export default async function AdminPage() {
  const t = await getTranslations("admin");
  const locale = await getLocale();
  const supabase = await createClient();

  // Pull orgs + their owner profile (FK on organizations.owner_id →
  // auth.users.id) + counts of members. The membership counts are
  // computed via a parallel SELECT on org_members rather than a join
  // because supabase-js doesn't expose aggregate joins cleanly.
  const [orgsRes, membersRes] = await Promise.all([
    supabase
      .from("organizations")
      .select(
        "id, name, created_at, suspended_at, suspended_reason, owner_id, owner:profiles!organizations_owner_id_fkey(email, full_name)",
      )
      .order("created_at", { ascending: false }),
    supabase.from("org_members").select("org_id"),
  ]);

  // Cast through unknown — Supabase types the M:1 join as an array,
  // runtime it's an object. Pattern used elsewhere in the codebase.
  const orgs = (orgsRes.data ?? []) as unknown as Array<{
    id: string;
    name: string;
    created_at: string;
    suspended_at: string | null;
    suspended_reason: string | null;
    owner_id: string;
    owner: { email: string; full_name: string | null } | null;
  }>;
  const memberRows = (membersRes.data ?? []) as Array<{ org_id: string }>;

  const memberCounts = new Map<string, number>();
  for (const r of memberRows) {
    memberCounts.set(r.org_id, (memberCounts.get(r.org_id) ?? 0) + 1);
  }

  const rows: AdminOrgRow[] = orgs.map((o) => ({
    id: o.id,
    name: o.name,
    ownerEmail: o.owner?.email ?? null,
    ownerName: o.owner?.full_name ?? null,
    memberCount: memberCounts.get(o.id) ?? 0,
    createdAt: o.created_at,
    suspendedAt: o.suspended_at,
    suspendedReason: o.suspended_reason,
  }));

  const stats = {
    totalOrgs: orgs.length,
    activeOrgs: orgs.filter((o) => !o.suspended_at).length,
    suspendedOrgs: orgs.filter((o) => o.suspended_at).length,
    totalMembers: memberRows.length,
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Link
              href="/dashboard"
              className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" />
              {t("title")}
            </Link>
            <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>
        </div>

        {/* 4-card stats strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label={t("stats.totalOrgs")} value={stats.totalOrgs} />
          <StatCard
            label={t("stats.activeOrgs")}
            value={stats.activeOrgs}
            tone="primary"
          />
          <StatCard
            label={t("stats.suspendedOrgs")}
            value={stats.suspendedOrgs}
            tone={stats.suspendedOrgs > 0 ? "warning" : "muted"}
          />
          <StatCard label={t("stats.totalMembers")} value={stats.totalMembers} />
        </div>

        <AdminOrgsTable rows={rows} locale={locale} />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: number;
  tone?: "muted" | "primary" | "warning";
}) {
  const valueClass =
    tone === "primary"
      ? "text-primary"
      : tone === "warning"
        ? "text-amber-600 dark:text-amber-400"
        : "text-foreground";
  return (
    <Card className="bg-card border-border shadow-card">
      <CardContent className="pt-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className={`mt-1 text-2xl font-bold ${valueClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
