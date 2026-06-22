import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

/**
 * Server-side gate for /admin routes.
 *
 * Use in Server Components or Route Handlers — anywhere `redirect()`
 * works. Returns the authenticated user object on success; redirects
 * away on every other path. Never throws.
 *
 *   import { assertSuperAdmin } from "@/lib/admin/guard"
 *   export default async function AdminPage() {
 *     await assertSuperAdmin()
 *     // ... rest of the page
 *   }
 *
 * Convention: `profiles.role = 'super_admin'` (see migration 019).
 */
export async function assertSuperAdmin(): Promise<User> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profile?.role !== "super_admin") {
    // Funnel non-admins back to the regular dashboard. They never
    // saw the /admin link in the sidebar so reaching this path is
    // either a typed URL or a stale bookmark.
    redirect("/dashboard");
  }

  return user;
}

/**
 * Same gate but for Route Handlers that want to respond with 403
 * instead of issuing a redirect. Returns `null` on the auth fail
 * path; the caller branches on the return.
 */
export async function checkSuperAdmin(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  return profile?.role === "super_admin" ? user : null;
}
