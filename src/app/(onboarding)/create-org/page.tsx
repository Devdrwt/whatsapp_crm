"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/layout/auth-shell";

export default function CreateOrgPage() {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Organization name is required");
      return;
    }
    setLoading(true);

    // create_organization is a SECURITY DEFINER RPC that atomically
    // inserts into organizations + org_members. RLS would otherwise
    // block the very first insert into org_members.
    const { data: orgId, error: rpcError } = await supabase.rpc(
      "create_organization",
      { p_name: trimmed },
    );

    if (rpcError || !orgId) {
      setError(rpcError?.message ?? "Could not create the organization");
      setLoading(false);
      return;
    }

    // Pin the new org as the active one so the dashboard renders
    // against it on the first load.
    const res = await fetch("/api/orgs/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId }),
    });
    if (!res.ok) {
      setError("Organization created, but couldn't set it as active");
      setLoading(false);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  };

  return (
    <AuthShell
      title="Create your organization"
      description="Your workspace inside Drwintech. You can rename it any time."
    >
      <form onSubmit={handleCreate} className="flex flex-col gap-4">
        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="org-name">Organization name</Label>
          <Input
            id="org-name"
            type="text"
            placeholder="Acme — café El Buen Sabor"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
          />
        </div>

        <Button type="submit" disabled={loading} className="mt-2 h-10 w-full">
          {loading ? "Creating..." : "Create organization"}
        </Button>
      </form>
    </AuthShell>
  );
}
