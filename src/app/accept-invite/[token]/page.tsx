"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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

export default function AcceptInvitePage() {
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
      toast.success("Invitation accepted");
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      console.error("[accept-invite] POST failed:", err);
      setStatus({ kind: "error", code: "network" });
    }
  };

  if (status.kind === "loading" || loading) {
    return (
      <AuthShell title="Loading…" description="Checking your invitation.">
        <div className="flex items-center justify-center py-6">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </AuthShell>
    );
  }

  if (status.kind === "error") {
    const messages: Record<string, { title: string; body: string }> = {
      not_found: {
        title: "Invitation not found",
        body: "This link is invalid. Ask the inviter to send a new one.",
      },
      expired: {
        title: "Invitation expired",
        body: "Invitations are valid for 7 days. Ask the inviter to send a new one.",
      },
      already_accepted: {
        title: "Already accepted",
        body: "You've already joined this organization.",
      },
      email_mismatch: {
        title: "Email mismatch",
        body: "This invitation was sent to a different email. Sign out and sign back in with the email it was sent to.",
      },
      network: {
        title: "Network error",
        body: "Something went wrong. Check your connection and try again.",
      },
      rpc_failed: {
        title: "Could not accept",
        body: "Something went wrong on our side. Try again, or ask the inviter for help.",
      },
    };
    const m = messages[status.code] ?? messages.rpc_failed;
    return (
      <AuthShell title={m.title} description={m.body}>
        {status.code === "email_mismatch" ? (
          <Button onClick={signOut} className="w-full">
            Sign out
          </Button>
        ) : (
          <Link href="/dashboard">
            <Button variant="outline" className="w-full">
              Back to dashboard
            </Button>
          </Link>
        )}
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Join the organization"
      description={
        <>
          You&apos;ve been invited to join an organization on Drwintech as{" "}
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
            Joining…
          </>
        ) : (
          "Accept invitation"
        )}
      </Button>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Wrong account?{" "}
        <button
          type="button"
          onClick={signOut}
          className="font-medium text-primary hover:text-primary/80"
        >
          Sign out
        </button>{" "}
        and sign back in.
      </p>
    </AuthShell>
  );
}
