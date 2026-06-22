import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { setActiveOrgCookie } from "@/lib/orgs/active-org";

/**
 * Accept an org invitation. Body: `{ token }`. Calls the
 * `accept_invitation` SECURITY DEFINER RPC (migration 018) which
 * validates the token, matches the JWT email, inserts the membership
 * and marks the invitation accepted in a single atomic transaction.
 *
 * The RPC raises typed Postgres exceptions ("invitation_not_found"
 * etc.) — we map them here to user-facing HTTP responses.
 */
export async function POST(request: Request) {
  let body: { token?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const token = typeof body.token === "string" ? body.token : "";
  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: orgId, error } = await supabase.rpc("accept_invitation", {
    p_token: token,
  });

  if (error) {
    const msg = error.message || "";
    // Map the well-known exception strings to status codes the page
    // can render specifically.
    if (msg.includes("invitation_not_found")) {
      return NextResponse.json({ error: "not_found" }, { status: 410 });
    }
    if (msg.includes("invitation_already_accepted")) {
      return NextResponse.json({ error: "already_accepted" }, { status: 410 });
    }
    if (msg.includes("invitation_expired")) {
      return NextResponse.json({ error: "expired" }, { status: 410 });
    }
    if (msg.includes("invitation_email_mismatch")) {
      return NextResponse.json({ error: "email_mismatch" }, { status: 403 });
    }
    console.error("[accept-invitation] RPC failed:", error);
    return NextResponse.json({ error: "rpc_failed" }, { status: 500 });
  }

  if (!orgId || typeof orgId !== "string") {
    return NextResponse.json({ error: "rpc_failed" }, { status: 500 });
  }

  // Pin the just-joined org as the active one so the dashboard renders
  // against it on the first reload.
  await setActiveOrgCookie(orgId);
  return NextResponse.json({ orgId });
}
