import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrgIdFromCookies } from "@/lib/orgs/active-org";

/**
 * PATCH — change a member's role (admin / agent). The RLS policy
 *         "Admins manage membership" enforces the writer is admin or
 *         owner. We additionally guard against demoting / removing an
 *         owner (only an owner can touch another owner — and even then
 *         transfer-of-ownership is out of PR 4 scope, so we block it).
 *
 * DELETE — remove the membership. Same checks. The user_id parameter
 *          is the target member's user id, scoped to the active org.
 */

const TARGET_ROLES = ["admin", "agent"] as const;
type TargetRole = (typeof TARGET_ROLES)[number];

async function loadActor(orgId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, error: 401 as const };

  const { data: membership, error: memErr } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (memErr) {
    console.error("[members] actor lookup failed:", memErr);
    return { supabase, error: 500 as const };
  }
  if (!membership) return { supabase, error: 403 as const, user };
  return { supabase, actor: membership.role as "owner" | "admin" | "agent", user };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId: targetUserId } = await params;
  if (!targetUserId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const orgId = await getActiveOrgIdFromCookies();
  if (!orgId) {
    return NextResponse.json(
      { error: "No active organization" },
      { status: 400 },
    );
  }

  let body: { role?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const nextRole = typeof body.role === "string" ? body.role : "";
  if (!TARGET_ROLES.includes(nextRole as TargetRole)) {
    return NextResponse.json(
      { error: "Role must be 'admin' or 'agent'" },
      { status: 400 },
    );
  }

  const actor = await loadActor(orgId);
  if (actor.error === 401) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (actor.error === 403) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (actor.error === 500) return NextResponse.json({ error: "Lookup failed" }, { status: 500 });

  if (actor.actor === "agent") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { supabase } = actor;
  const { data: target, error: tErr } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", targetUserId)
    .maybeSingle();
  if (tErr) {
    console.error("[members] target lookup failed:", tErr);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
  if (!target) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }
  if (target.role === "owner") {
    return NextResponse.json(
      { error: "Cannot change an owner's role" },
      { status: 403 },
    );
  }

  const { error } = await supabase
    .from("org_members")
    .update({ role: nextRole })
    .eq("org_id", orgId)
    .eq("user_id", targetUserId);

  if (error) {
    if (error.code === "42501" || /row-level security/i.test(error.message)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[members] update role failed:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId: targetUserId } = await params;
  if (!targetUserId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const orgId = await getActiveOrgIdFromCookies();
  if (!orgId) {
    return NextResponse.json(
      { error: "No active organization" },
      { status: 400 },
    );
  }

  const actor = await loadActor(orgId);
  if (actor.error === 401) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (actor.error === 403) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (actor.error === 500) return NextResponse.json({ error: "Lookup failed" }, { status: 500 });

  if (actor.actor === "agent") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (actor.user.id === targetUserId) {
    return NextResponse.json(
      { error: "You cannot remove yourself; use transfer ownership first" },
      { status: 403 },
    );
  }

  const { supabase } = actor;
  const { data: target, error: tErr } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", targetUserId)
    .maybeSingle();
  if (tErr) {
    console.error("[members] target lookup failed:", tErr);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
  if (!target) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }
  if (target.role === "owner") {
    return NextResponse.json(
      { error: "Cannot remove an owner" },
      { status: 403 },
    );
  }

  const { error } = await supabase
    .from("org_members")
    .delete()
    .eq("org_id", orgId)
    .eq("user_id", targetUserId);

  if (error) {
    if (error.code === "42501" || /row-level security/i.test(error.message)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[members] delete failed:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
