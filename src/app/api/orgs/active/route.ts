import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getActiveOrgIdFromCookies,
  setActiveOrgCookie,
} from "@/lib/orgs/active-org";

/**
 * Active-organization endpoint.
 *
 * GET  → read the current active org id from the httpOnly cookie.
 * POST → switch the active org. Body: `{ orgId: string }`.
 *
 * Membership is enforced via the authenticated Supabase client: the
 * RLS policy "Members read membership" on `org_members` filters out
 * orgs the user isn't part of, so a SELECT that returns a row is
 * proof of membership.
 */

export async function GET() {
  const orgId = await getActiveOrgIdFromCookies();
  return NextResponse.json({ orgId });
}

export async function POST(request: Request) {
  let body: { orgId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orgId = typeof body.orgId === "string" ? body.orgId : "";
  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: membership, error: memberError } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("org_id", orgId)
    .maybeSingle();

  if (memberError) {
    console.error("[orgs/active] membership lookup failed:", memberError);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await setActiveOrgCookie(orgId);
  return NextResponse.json({ orgId });
}
