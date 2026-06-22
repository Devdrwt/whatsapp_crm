import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrgIdFromCookies } from "@/lib/orgs/active-org";

/**
 * List members of the active org with their joined profile (name +
 * avatar). RLS "Members read membership" gates the read — every member
 * sees the full membership list; `profiles` is identity-keyed so the
 * inner join surfaces only the profiles of those user_ids.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const orgId = await getActiveOrgIdFromCookies();
  if (!orgId) {
    return NextResponse.json(
      { error: "No active organization" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("org_members")
    .select(
      "user_id, role, created_at, profiles!inner(user_id, full_name, email, avatar_url)",
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[members] list failed:", error);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }

  // Supabase types the join as an array; at runtime it's an object
  // (M:1). Flatten to the shape the panel expects.
  const rows = (data ?? []) as unknown as Array<{
    user_id: string;
    role: "owner" | "admin" | "agent";
    created_at: string;
    profiles: {
      user_id: string;
      full_name: string | null;
      email: string;
      avatar_url: string | null;
    };
  }>;

  const members = rows.map((r) => ({
    user_id: r.user_id,
    role: r.role,
    created_at: r.created_at,
    full_name: r.profiles.full_name,
    email: r.profiles.email,
    avatar_url: r.profiles.avatar_url,
  }));

  return NextResponse.json({ members });
}
