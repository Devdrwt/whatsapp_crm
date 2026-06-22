"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { AuthShell } from "@/components/layout/auth-shell";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth.forgotPassword");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <AuthShell
        title={t("checkEmailTitle")}
        description={
          <>
            {t("checkEmailDescriptionPrefix")}{" "}
            <span className="font-medium text-foreground">{email}</span>
            {t("checkEmailDescriptionSuffix")}
          </>
        }
      >
        <Link href="/login">
          <Button variant="outline" className="w-full">
            {t("backToSignIn")}
          </Button>
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t("title")} description={t("description")}>
      <form onSubmit={handleReset} className="flex flex-col gap-4">
        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="email">{t("email")}</Label>
          <Input
            id="email"
            type="email"
            placeholder={t("emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <Button type="submit" disabled={loading} className="mt-2 h-10 w-full">
          {loading ? t("submitting") : t("submit")}
        </Button>
      </form>

      <Link
        href="/login"
        className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("backToSignIn")}
      </Link>
    </AuthShell>
  );
}
