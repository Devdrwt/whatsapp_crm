import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkSuperAdmin } from "@/lib/admin/guard";

/**
 * Suspend / unsuspend an organization. Super-admin only.
 *
 * POST   /api/admin/orgs/[id]/suspend   { reason?: string }
 *   → sets organizations.suspended_at = now() + optional reason.
 *
 * DELETE /api/admin/orgs/[id]/suspend
 *   → clears suspended_at + suspended_reason.
 *
 * The mutation goes through the regular authenticated Supabase
 * client — the RLS policy "Super-admins update organizations"
 * (migration 019) gates it. No service-role key needed.
 */

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const admin = await checkSuperAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  let body: { reason?: unknown };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }
  const reason =
    typeof body.reason === "string" && body.reason.trim().length > 0
      ? body.reason.trim().slice(0, 500)
      : null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .update({
      suspended_at: new Date().toISOString(),
      suspended_reason: reason,
    })
    .eq("id", id)
    .select("id, name, suspended_at, suspended_reason")
    .maybeSingle();

  if (error) {
    console.error("[admin/suspend] POST failed:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ organization: data });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const admin = await checkSuperAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .update({ suspended_at: null, suspended_reason: null })
    .eq("id", id)
    .select("id, name, suspended_at")
    .maybeSingle();

  if (error) {
    console.error("[admin/suspend] DELETE failed:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ organization: data });
}
