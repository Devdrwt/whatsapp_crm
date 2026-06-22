"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/layout/auth-shell";

/**
 * Accept-invitation page.
 *
 * The middleware ensures the visitor is authenticated (with a
 * round-tripped `?next=/accept-invite/<token>` to bring them back
 * after a fresh sign-in). Once auth is settled we POST the token to
 * `/api/orgs/accept-invitation` which calls the RPC, sets the active
 * org cookie, and returns `{ orgId }`. We then refresh the orgs list
 * in `useAuth` so the OrgSwitcher reflects the new membership, and
 * land on `/dashboard`.
 */

type Status =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "accepting" }
  | { kind: "error"; code: string };

type ErrorCode =
  | "not_found"
  | "expired"
  | "already_accepted"
  | "email_mismatch"
  | "network"
  | "rpc_failed";

const KNOWN_CODES: readonly ErrorCode[] = [
  "not_found",
  "expired",
  "already_accepted",
  "email_mismatch",
  "network",
  "rpc_failed",
];

function toKnownCode(raw: string): ErrorCode {
  return (KNOWN_CODES as readonly string[]).includes(raw)
    ? (raw as ErrorCode)
    : "rpc_failed";
}

export default function AcceptInvitePage() {
  const t = useTranslations("acceptInvite");
  const params = useParams<{ token: string }>();
  const token = params.token;
  const router = useRouter();
  const { loading, user, refreshOrgs, signOut } = useAuth();
  const [status, setStatus] = useState<Status>({ kind: "loading" });

  useEffect(() => {
    if (loading) return;
    if (!user) return; // middleware handles the redirect
    // Auth settled and user present → move out of the loading screen.
    // React 19 flags synchronous setState in effects, but this gate is
    // exactly what the rule is meant to skip.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus({ kind: "ready" });
  }, [loading, user]);

  const accept = async () => {
    setStatus({ kind: "accepting" });
    try {
      const res = await fetch("/api/orgs/accept-invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setStatus({ kind: "error", code: data.error ?? "rpc_failed" });
        return;
      }
      await refreshOrgs();
      toast.success(t("successToast"));
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      console.error("[accept-invite] POST failed:", err);
      setStatus({ kind: "error", code: "network" });
    }
  };

  if (status.kind === "loading" || loading) {
    return (
      <AuthShell title={t("loadingTitle")} description={t("loadingDescription")}>
        <div className="flex items-center justify-center py-6">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </AuthShell>
    );
  }

  if (status.kind === "error") {
    const code = toKnownCode(status.code);
    return (
      <AuthShell title={t(`errors.${code}.title`)} description={t(`errors.${code}.body`)}>
        {code === "email_mismatch" ? (
          <Button onClick={signOut} className="w-full">
            {t("signOut")}
          </Button>
        ) : (
          <Link href="/dashboard">
            <Button variant="outline" className="w-full">
              {t("backToDashboard")}
            </Button>
          </Link>
        )}
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t("joinTitle")}
      description={
        <>
          {t("joinDescriptionPrefix")}{" "}
          <span className="font-medium text-foreground">{user?.email}</span>.
        </>
      }
    >
      <Button
        onClick={accept}
        disabled={status.kind === "accepting"}
        className="w-full"
      >
        {status.kind === "accepting" ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            {t("accepting")}
          </>
        ) : (
          t("accept")
        )}
      </Button>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        {t("wrongAccountPrefix")}{" "}
        <button
          type="button"
          onClick={signOut}
          className="font-medium text-primary hover:text-primary/80"
        >
          {t("signOut")}
        </button>{" "}
        {t("wrongAccountSuffix")}
      </p>
    </AuthShell>
  );
}
