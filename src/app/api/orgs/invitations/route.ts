import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrgIdFromCookies } from "@/lib/orgs/active-org";
import { getActiveLocale } from "@/lib/i18n/active-locale";
import { sendEmail } from "@/lib/email/resend";
import { renderInvitationEmail } from "@/lib/email/templates/invitation";

/**
 * Org invitations endpoint (Team management).
 *
 * GET  — list pending invitations for the active org. RLS policy
 *        "Admins manage invitations" filters server-side: an `agent`
 *        gets `[]`, an `admin`/`owner` gets the rows.
 * POST — create (or refresh) an invitation. `{ email, role }`.
 *        UPSERT on the existing `UNIQUE(org_id, email)` constraint so
 *        re-inviting the same address simply rotates the token and
 *        expiry. RLS gates writes to admins / owners.
 */

const ROLES = ["admin", "agent"] as const;
type InviteRole = (typeof ROLES)[number];

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

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
    .from("org_invitations")
    .select("id, email, role, token, expires_at, accepted_at, created_at")
    .eq("org_id", orgId)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[invitations] list failed:", error);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
  return NextResponse.json({ invitations: data ?? [] });
}

export async function POST(request: Request) {
  let body: { email?: unknown; role?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const role = typeof body.role === "string" ? body.role : "";

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  if (!ROLES.includes(role as InviteRole)) {
    return NextResponse.json(
      { error: "Role must be 'admin' or 'agent'" },
      { status: 400 },
    );
  }

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

  // Random URL-safe token. UUIDv4 has plenty of entropy (122 bits) and
  // is already available without an extra dependency.
  const token = crypto.randomUUID().replace(/-/g, "");
  const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("org_invitations")
    .upsert(
      {
        org_id: orgId,
        email: email.toLowerCase(),
        role,
        token,
        expires_at,
        accepted_at: null,
      },
      { onConflict: "org_id,email" },
    )
    .select("id, email, role, token, expires_at, accepted_at, created_at")
    .single();

  if (error) {
    // RLS rejection surfaces as a normal Postgres error here.
    if (error.code === "42501" || /row-level security/i.test(error.message)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[invitations] upsert failed:", error);
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  }

  // Fire-and-forget invitation email. The DB row is already saved
  // and the API response carries the token + URL for the inviter to
  // hand-deliver if the email fails — so we never await this and we
  // never let it throw past the catch.
  try {
    // Inviter display name + org name for the subject line. Two
    // tiny lookups, parallelized. Either one missing is fine — we
    // fall back gracefully so the email still sends.
    const [profileRes, orgRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, email")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("organizations")
        .select("name")
        .eq("id", orgId)
        .maybeSingle(),
    ]);

    const inviterName =
      profileRes.data?.full_name?.trim() ||
      profileRes.data?.email ||
      user.email ||
      "Drwintech";
    const orgName = orgRes.data?.name?.trim() || "Drwintech";
    const locale = await getActiveLocale();

    // Build the absolute /accept-invite/<token> URL. NEXT_PUBLIC_SITE_URL
    // is set per-deployment (.env.local); fall back to the request
    // origin so dev still works without that env.
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
      new URL(request.url).origin;
    const acceptUrl = `${origin}/accept-invite/${token}`;

    const rendered = renderInvitationEmail({
      locale,
      inviterName,
      orgName,
      acceptUrl,
      role: role as InviteRole,
    });

    // Never await — Resend can take a second or two, the inviter
    // shouldn't wait. The send helper already swallows its own
    // errors, but we wrap once more for safety.
    void sendEmail({
      to: email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    }).catch((err) => {
      console.error("[invitations] email send failed:", err);
    });
  } catch (err) {
    // Profile / org lookup or template rendering blew up. Log and
    // move on — the invitation row + the URL in the response are
    // still good.
    console.error("[invitations] email pipeline failed:", err);
  }

  return NextResponse.json({ invitation: data }, { status: 201 });
}
