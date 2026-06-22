"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Check,
  Copy,
  Loader2,
  MoreHorizontal,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { OrgRole } from "@/types";

interface Member {
  user_id: string;
  role: OrgRole;
  created_at: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

interface Invitation {
  id: string;
  email: string;
  role: "admin" | "agent";
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

function inviteUrl(token: string): string {
  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return `${base}/accept-invite/${token}`;
}

type PendingT = ReturnType<typeof useTranslations<"settings.team.pending">>

function relativeDeadline(iso: string, t: PendingT): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = then - now;
  if (diffMs <= 0) return t("expired");
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days >= 1) return t("expiresInDays", { days });
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  return t("expiresInHours", { hours });
}

export function TeamPanel() {
  const { user, activeOrg, orgsLoading } = useAuth();
  const t = useTranslations("settings.team");
  const tPending = useTranslations("settings.team.pending");
  const tRoles = useTranslations("settings.team.roles");
  const canManage =
    activeOrg?.role === "owner" || activeOrg?.role === "admin";

  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "agent">("agent");
  const [inviting, setInviting] = useState(false);
  const [justCreated, setJustCreated] = useState<Invitation | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [memRes, invRes] = await Promise.all([
        fetch("/api/orgs/members", { cache: "no-store" }),
        fetch("/api/orgs/invitations", { cache: "no-store" }),
      ]);
      if (memRes.ok) {
        const j = (await memRes.json()) as { members: Member[] };
        setMembers(j.members ?? []);
      }
      if (invRes.ok) {
        const j = (await invRes.json()) as { invitations: Invitation[] };
        setInvitations(j.invitations ?? []);
      }
    } catch (err) {
      console.error("[team] load failed:", err);
      toast.error(t("loadFailed"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (orgsLoading) return;
    if (!activeOrg) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    load();
  }, [orgsLoading, activeOrg, load]);

  async function handleInvite() {
    if (!inviteEmail.trim()) {
      toast.error(t("toasts.emailRequired"));
      return;
    }
    try {
      setInviting(true);
      const res = await fetch("/api/orgs/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      });
      const data = (await res.json()) as {
        invitation?: Invitation;
        error?: string;
      };
      if (!res.ok || !data.invitation) {
        toast.error(data.error ?? t("toasts.inviteFailed"));
        return;
      }
      setJustCreated(data.invitation);
      setInviteEmail("");
      setInviteRole("agent");
      toast.success(t("toasts.inviteCreated"));
      await load();
    } catch (err) {
      console.error("[team] invite failed:", err);
      toast.error(t("toasts.inviteFailed"));
    } finally {
      setInviting(false);
    }
  }

  async function revokeInvitation(id: string) {
    if (!confirm(t("prompts.revoke"))) return;
    try {
      const res = await fetch(`/api/orgs/invitations/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? t("toasts.revokeFailed"));
        return;
      }
      toast.success(t("toasts.revoked"));
      setInvitations((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      console.error("[team] revoke failed:", err);
      toast.error(t("toasts.revokeFailed"));
    }
  }

  async function changeRole(userId: string, role: "admin" | "agent") {
    try {
      const res = await fetch(`/api/orgs/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? t("toasts.roleUpdateFailed"));
        return;
      }
      toast.success(t("toasts.roleUpdated"));
      setMembers((prev) =>
        prev.map((m) => (m.user_id === userId ? { ...m, role } : m)),
      );
    } catch (err) {
      console.error("[team] change role failed:", err);
      toast.error(t("toasts.roleUpdateFailed"));
    }
  }

  async function removeMember(userId: string, label: string) {
    if (!confirm(t("prompts.remove", { label }))) return;
    try {
      const res = await fetch(`/api/orgs/members/${userId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? t("toasts.removeFailed"));
        return;
      }
      toast.success(t("toasts.memberRemoved"));
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
    } catch (err) {
      console.error("[team] remove failed:", err);
      toast.error(t("toasts.removeFailed"));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("subtitle", { orgName: activeOrg?.name ?? t("fallbackOrgName") })}
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => {
              setInviteOpen(true);
              setJustCreated(null);
            }}
            className="shrink-0"
          >
            <UserPlus className="size-4" />
            {t("invite")}
          </Button>
        )}
      </div>

      {/* Members */}
      <Card className="bg-card border-border shadow-card">
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {members.map((m) => {
              const isSelf = user?.id === m.user_id;
              const initial =
                m.full_name?.charAt(0)?.toUpperCase() ??
                m.email.charAt(0).toUpperCase();
              return (
                <li
                  key={m.user_id}
                  className="flex items-center gap-3 px-5 py-3.5"
                >
                  <Avatar className="size-9 shrink-0">
                    {m.avatar_url ? (
                      <AvatarImage src={m.avatar_url} alt={m.full_name ?? m.email} />
                    ) : null}
                    <AvatarFallback className="bg-primary-soft text-sm font-medium text-primary">
                      {initial}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {m.full_name ?? m.email}
                      {isSelf && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {t("you")}
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {m.email}
                    </p>
                  </div>
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    m.role === "owner"
                      ? "bg-primary-soft text-primary"
                      : m.role === "admin"
                      ? "bg-blue-500/10 text-blue-700 dark:text-blue-300"
                      : "bg-muted text-muted-foreground",
                  )}>
                    {tRoles(m.role)}
                  </span>
                  {canManage && m.role !== "owner" && !isSelf && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label={t("memberActions")}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-44">
                        <DropdownMenuItem
                          onClick={() =>
                            changeRole(
                              m.user_id,
                              m.role === "admin" ? "agent" : "admin",
                            )
                          }
                        >
                          <Check className="size-4" />
                          {m.role === "admin" ? t("demoteToAgent") : t("promoteToAdmin")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => removeMember(m.user_id, m.full_name ?? m.email)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="size-4" />
                          {t("removeMember")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {/* Pending invitations — admin/owner only */}
      {canManage && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">
            {tPending("title")}
          </h3>
          {invitations.length === 0 ? (
            <Card className="bg-card border-border shadow-card">
              <CardContent className="px-5 py-6 text-center text-sm text-muted-foreground">
                {tPending("empty")}
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-card border-border shadow-card">
              <CardContent className="p-0">
                <ul className="divide-y divide-border">
                  {invitations.map((inv) => (
                    <li
                      key={inv.id}
                      className="flex items-center gap-3 px-5 py-3.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {inv.email}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {tRoles(inv.role)} · {relativeDeadline(inv.expires_at, tPending)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(inviteUrl(inv.token));
                          toast.success(t("toasts.urlCopied"));
                        }}
                        title={tPending("copyTitle")}
                        className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        <Copy className="size-3.5" />
                        {tPending("copyUrl")}
                      </button>
                      <button
                        type="button"
                        onClick={() => revokeInvitation(inv.id)}
                        title={tPending("revokeTitle")}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("inviteDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("inviteDialog.description", { orgName: activeOrg?.name ?? t("inviteDialog.fallbackOrgName") })}
            </DialogDescription>
          </DialogHeader>

          {justCreated ? (
            <div className="space-y-3 py-2">
              <Label>{t("inviteDialog.url")}</Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={inviteUrl(justCreated.token)}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(inviteUrl(justCreated.token));
                    toast.success(t("toasts.copied"));
                  }}
                  variant="outline"
                >
                  <Copy className="size-4" />
                  {t("inviteDialog.copy")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("inviteDialog.sendHint", { email: justCreated.email })}
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="invite-email">{t("inviteDialog.email")}</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder={t("inviteDialog.emailPlaceholder")}
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>{t("inviteDialog.role")}</Label>
                <Select
                  value={inviteRole}
                  onValueChange={(v) => setInviteRole(v as "admin" | "agent")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agent">{t("inviteDialog.roleAgent")}</SelectItem>
                    <SelectItem value="admin">{t("inviteDialog.roleAdmin")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            {justCreated ? (
              <Button onClick={() => setInviteOpen(false)}>{t("inviteDialog.done")}</Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setInviteOpen(false)}
                  disabled={inviting}
                >
                  {t("inviteDialog.cancel")}
                </Button>
                <Button onClick={handleInvite} disabled={inviting}>
                  {inviting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {t("inviteDialog.creating")}
                    </>
                  ) : (
                    t("inviteDialog.create")
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
