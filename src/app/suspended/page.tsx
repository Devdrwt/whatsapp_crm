import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrgIdFromCookies } from "@/lib/orgs/active-org";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/layout/auth-shell";

/**
 * Landing page for members of a suspended org. The middleware
 * routes here for any /dashboard, /inbox, etc. access while the
 * active org is suspended. Server-rendered so we can display the
 * org name + the reason if provided.
 *
 * If the user has no suspended active org, bounce them back to
 * the dashboard — they shouldn't see this page from a typed URL.
 */
export default async function SuspendedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const activeOrgId = await getActiveOrgIdFromCookies();
  if (!activeOrgId) redirect("/dashboard");

  const { data: org } = await supabase
    .from("organizations")
    .select("name, suspended_at, suspended_reason")
    .eq("id", activeOrgId)
    .maybeSingle();

  if (!org || !org.suspended_at) {
    redirect("/dashboard");
  }

  const t = await getTranslations("suspended");

  return (
    <AuthShell
      title={t("title")}
      description={t.rich("description", {
        orgName: org.name,
        strong: (chunks) => <strong>{chunks}</strong>,
      })}
    >
      {org.suspended_reason && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <p className="font-medium">{t("reasonLabel")}</p>
          <p className="mt-1">{org.suspended_reason}</p>
        </div>
      )}
      <Link href="/dashboard">
        <Button variant="outline" className="w-full">
          {t("switchOrg")}
        </Button>
      </Link>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        {t("contactSupport")}
      </p>
    </AuthShell>
  );
}
