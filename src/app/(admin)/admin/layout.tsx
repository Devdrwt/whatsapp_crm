import type { Metadata } from "next";
import type { ReactNode } from "react";
import { assertSuperAdmin } from "@/lib/admin/guard";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Gate for /admin/*. Redirects non-super-admins to /login or /dashboard
 * before the page renders — no 403 mid-page, no flash of admin content.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await assertSuperAdmin();
  return children;
}
