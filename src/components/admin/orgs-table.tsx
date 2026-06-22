"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pause, Play } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface AdminOrgRow {
  id: string;
  name: string;
  ownerEmail: string | null;
  ownerName: string | null;
  memberCount: number;
  createdAt: string;
  suspendedAt: string | null;
  suspendedReason: string | null;
}

interface Props {
  rows: AdminOrgRow[];
  locale: string;
}

export function AdminOrgsTable({ rows, locale }: Props) {
  const t = useTranslations("admin.orgsTable");
  const tSuspend = useTranslations("admin.suspendDialog");
  const tUnsuspend = useTranslations("admin.unsuspendDialog");
  const tToasts = useTranslations("admin.toasts");
  const router = useRouter();

  const [pending, setPending] = useState<{
    org: AdminOrgRow;
    kind: "suspend" | "unsuspend";
  } | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  async function confirm() {
    if (!pending) return;
    setSubmitting(true);
    try {
      const path = `/api/admin/orgs/${pending.org.id}/suspend`;
      const res = await fetch(path, {
        method: pending.kind === "suspend" ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body:
          pending.kind === "suspend"
            ? JSON.stringify({ reason: reason.trim() || undefined })
            : undefined,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? tToasts("actionFailed"));
        return;
      }
      toast.success(
        pending.kind === "suspend"
          ? tToasts("suspended")
          : tToasts("unsuspended"),
      );
      setPending(null);
      setReason("");
      router.refresh();
    } catch (err) {
      console.error("[admin] suspend action failed:", err);
      toast.error(tToasts("actionFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          {t("title")}
        </h2>
        <Card className="bg-card border-border shadow-card">
          <CardContent className="p-0">
            {rows.length === 0 ? (
              <p className="px-5 py-12 text-center text-sm text-muted-foreground">
                {t("empty")}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">{t("headers.name")}</TableHead>
                    <TableHead className="text-muted-foreground hidden md:table-cell">{t("headers.owner")}</TableHead>
                    <TableHead className="text-muted-foreground text-right">{t("headers.members")}</TableHead>
                    <TableHead className="text-muted-foreground hidden lg:table-cell">{t("headers.createdAt")}</TableHead>
                    <TableHead className="text-muted-foreground">{t("headers.status")}</TableHead>
                    <TableHead className="text-muted-foreground w-32">{t("headers.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const isSuspended = !!row.suspendedAt;
                    return (
                      <TableRow key={row.id} className="border-border">
                        <TableCell className="font-medium text-foreground">
                          {row.name}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm">
                          <div className="text-foreground">{row.ownerName ?? "—"}</div>
                          {row.ownerEmail && (
                            <div className="text-xs text-muted-foreground">
                              {row.ownerEmail}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm text-foreground tabular-nums">
                          {t("membersCount", { count: row.memberCount })}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                          {fmtDate(row.createdAt)}
                        </TableCell>
                        <TableCell>
                          {isSuspended ? (
                            <span
                              className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                              title={
                                row.suspendedAt
                                  ? t("suspendedAt", { date: fmtDate(row.suspendedAt) })
                                  : undefined
                              }
                            >
                              {t("statusSuspended")}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                              {t("statusActive")}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isSuspended ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setPending({ org: row, kind: "unsuspend" });
                                setReason("");
                              }}
                            >
                              <Play className="h-3.5 w-3.5" />
                              {t("unsuspend")}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setPending({ org: row, kind: "suspend" });
                                setReason("");
                              }}
                              className="border-amber-500/40 text-amber-700 hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-300 dark:hover:text-amber-300"
                            >
                              <Pause className="h-3.5 w-3.5" />
                              {t("suspend")}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={!!pending}
        onOpenChange={(v) => {
          if (!v) {
            setPending(null);
            setReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          {pending?.kind === "suspend" ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {tSuspend("title", { orgName: pending.org.name })}
                </DialogTitle>
                <DialogDescription>{tSuspend("description")}</DialogDescription>
              </DialogHeader>
              <div className="space-y-2 py-2">
                <Label htmlFor="suspend-reason">{tSuspend("reasonLabel")}</Label>
                <Textarea
                  id="suspend-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={tSuspend("reasonPlaceholder")}
                  className="min-h-20"
                />
              </div>
              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => setPending(null)}
                  disabled={submitting}
                >
                  {tSuspend("cancel")}
                </Button>
                <Button
                  onClick={confirm}
                  disabled={submitting}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {submitting ? tSuspend("suspending") : tSuspend("confirm")}
                </Button>
              </DialogFooter>
            </>
          ) : pending ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {tUnsuspend("title", { orgName: pending.org.name })}
                </DialogTitle>
                <DialogDescription>{tUnsuspend("description")}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => setPending(null)}
                  disabled={submitting}
                >
                  {tUnsuspend("cancel")}
                </Button>
                <Button onClick={confirm} disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {submitting ? tUnsuspend("unsuspending") : tUnsuspend("confirm")}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
