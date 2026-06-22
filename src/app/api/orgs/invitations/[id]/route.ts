import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Revoke a pending invitation. Admin / owner only — the RLS policy
 * "Admins manage invitations" enforces it.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase.from("org_invitations").delete().eq("id", id);
  if (error) {
    if (error.code === "42501" || /row-level security/i.test(error.message)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[invitations] delete failed:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
