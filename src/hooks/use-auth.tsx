"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { OrganizationWithRole } from "@/types";

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  role: string | null;
  /**
   * Opted-in beta feature keys for this account. No current feature
   * reads this — Flows was the last user and went to soft-GA in PR
   * #134 — but the column survives for future beta gates.
   */
  beta_features: string[];
}

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  /**
   * Session-level loading. Flips to false as soon as we know whether
   * a user is signed in, *without* waiting for the profile row. Use
   * this for chrome (sidebar / header) that can render with just the
   * user object.
   */
  loading: boolean;
  /**
   * Profile-row loading. Stays true until `fetchProfile` settles
   * (success, missing row, or error). Code that branches on
   * `profile.beta_features` MUST gate on this — otherwise it sees the
   * `{ loading: false, profile: null }` window during initial load
   * and may take the "not opted in" branch incorrectly.
   */
  profileLoading: boolean;
  /** Organizations the current user belongs to, with their role in each. */
  orgs: OrganizationWithRole[];
  /** Currently-active org id (mirrors the `drwintech.org-id` cookie). */
  activeOrgId: string | null;
  /** The OrganizationWithRole entry matching `activeOrgId`, or null if
   *  not yet resolved. Convenience for role-gated UI — `activeOrg.role`
   *  is what callers should read. */
  activeOrg: OrganizationWithRole | null;
  /** Stays true until orgs + active-org id have both settled. */
  orgsLoading: boolean;
  signOut: () => Promise<void>;
  /** Re-fetch the current user's profile row — call after a save from
   *  the settings form so header/sidebar reflect the change without a
   *  full page reload. */
  refreshProfile: () => Promise<void>;
  /** Re-fetch the orgs list — call after creating/joining an org. */
  refreshOrgs: () => Promise<void>;
  /** Switch the active organization. Validates membership server-side,
   *  rewrites the cookie, then triggers a server-component refresh. */
  switchOrg: (orgId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * AuthProvider — wrap this around the dashboard layout.
 * Makes ONE getSession() call for the whole tree instead of one per
 * component, avoiding internal lock contention in the Supabase client.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);

  const [orgs, setOrgs] = useState<OrganizationWithRole[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [orgsLoading, setOrgsLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const supabase = createClient();
    setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url, role, beta_features")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("[AuthProvider] fetchProfile error:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        return;
      }

      if (data) {
        setProfile({
          ...data,
          beta_features: data.beta_features ?? [],
        });
      }
    } catch (err) {
      console.error("[AuthProvider] fetchProfile threw:", err);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  // Load orgs (via RLS, scoped to the current user) and the active org
  // id (from the httpOnly cookie via /api/orgs/active). Settles
  // `orgsLoading` once both queries return, success or fail.
  const fetchOrgs = useCallback(async (userId: string) => {
    const supabase = createClient();
    setOrgsLoading(true);
    try {
      const [memberRes, activeRes] = await Promise.all([
        supabase
          .from("org_members")
          .select("role, organizations!inner(*)")
          .eq("user_id", userId),
        fetch("/api/orgs/active", { cache: "no-store" }).then((r) =>
          r.ok ? (r.json() as Promise<{ orgId: string | null }>) : null,
        ),
      ]);

      if (memberRes.error) {
        console.error("[AuthProvider] fetchOrgs error:", memberRes.error.message);
      }

      // Supabase generic inference types the joined `organizations`
      // relation as an array, but at runtime it's a single object
      // (org_members → organizations is M:1). Cast through `unknown`.
      const rows = (memberRes.data ?? []) as unknown as Array<{
        role: OrganizationWithRole["role"];
        organizations: Omit<OrganizationWithRole, "role">;
      }>;
      const list: OrganizationWithRole[] = rows.map((r) => ({
        ...r.organizations,
        role: r.role,
      }));
      setOrgs(list);

      const cookieOrgId = activeRes?.orgId ?? null;
      // Fall back to the first org the user belongs to if the cookie is
      // missing — matches what the middleware would set on the next hop.
      const resolved =
        cookieOrgId && list.some((o) => o.id === cookieOrgId)
          ? cookieOrgId
          : (list[0]?.id ?? null);
      setActiveOrgId(resolved);
    } catch (err) {
      console.error("[AuthProvider] fetchOrgs threw:", err);
    } finally {
      setOrgsLoading(false);
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    const safetyTimer = setTimeout(() => {
      if (mounted) {
        console.warn("[AuthProvider] getSession() timed out after 3s");
        setLoading(false);
        setProfileLoading(false);
        setOrgsLoading(false);
      }
    }, 3000);

    const init = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) console.error("[AuthProvider] getSession error:", error.message);

        if (!mounted) return;
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          fetchProfile(currentUser.id);
          fetchOrgs(currentUser.id);
        } else {
          setProfileLoading(false);
          setOrgsLoading(false);
        }
      } catch (err) {
        console.error("[AuthProvider] init threw:", err);
      } finally {
        if (mounted) setLoading(false);
        clearTimeout(safetyTimer);
      }
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        fetchProfile(currentUser.id);
        fetchOrgs(currentUser.id);
      } else {
        setProfile(null);
        setProfileLoading(false);
        setOrgs([]);
        setActiveOrgId(null);
        setOrgsLoading(false);
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, [fetchProfile, fetchOrgs]);

  const signOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setOrgs([]);
    setActiveOrgId(null);
    window.location.href = "/login";
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user?.id) return;
    await fetchProfile(user.id);
  }, [user?.id, fetchProfile]);

  const refreshOrgs = useCallback(async () => {
    if (!user?.id) return;
    await fetchOrgs(user.id);
  }, [user?.id, fetchOrgs]);

  const switchOrg = useCallback(
    async (orgId: string) => {
      if (orgId === activeOrgId) return;
      const res = await fetch("/api/orgs/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
        cache: "no-store",
      });
      if (!res.ok) {
        console.error("[AuthProvider] switchOrg failed:", res.status);
        return;
      }
      setActiveOrgId(orgId);
      // Re-render Server Components against the new cookie.
      router.refresh();
    },
    [activeOrgId, router],
  );

  // Derived: which `OrganizationWithRole` is the active one? Cheap
  // `.find` recomputed only when orgs or activeOrgId change.
  const activeOrg =
    (activeOrgId && orgs.find((o) => o.id === activeOrgId)) || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        profileLoading,
        orgs,
        activeOrgId,
        activeOrg,
        orgsLoading,
        signOut,
        refreshProfile,
        refreshOrgs,
        switchOrg,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * useAuth — read the shared auth state from context.
 * Must be used inside an <AuthProvider>.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      user: null,
      profile: null,
      loading: false,
      profileLoading: false,
      orgs: [],
      activeOrgId: null,
      activeOrg: null,
      orgsLoading: false,
      signOut: async () => {
        window.location.href = "/login";
      },
      refreshProfile: async () => {},
      refreshOrgs: async () => {},
      switchOrg: async () => {},
    };
  }
  return ctx;
}
