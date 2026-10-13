"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Mail, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createAdminI18n, type AdminLocale } from "@/lib/admin-i18n";

export function LoginForm({ redirectTo, locale }: { redirectTo: string; locale: AdminLocale }) {
  const router = useRouter();
  const { t } = React.useMemo(() => createAdminI18n(locale), [locale]);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.error ?? "Sign in failed");
        }
        toast.success(t("Welcome back"));
        router.push(redirectTo);
        router.refresh();
      } catch (err) {
        toast.error(t((err as Error).message));
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email">{t("Email")}</Label>
        <div className="relative" dir="ltr">
          <Mail
            className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black-iron/40"
            strokeWidth={1.5}
          />
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="ps-10"
            placeholder="you@shazdeh.ae"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">{t("Password")}</Label>
        <div className="relative" dir="ltr">
          <Lock
            className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black-iron/40"
            strokeWidth={1.5}
          />
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="ps-10"
            placeholder="••••••••"
          />
        </div>
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("Signing in")}
          </>
        ) : (
          t("Sign in")
        )}
      </Button>
    </form>
  );
}
