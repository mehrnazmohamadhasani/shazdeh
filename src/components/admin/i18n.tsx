"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import {
  ADMIN_LOCALE_COOKIE,
  createAdminI18n,
  type AdminI18n,
  type AdminLocale,
} from "@/lib/admin-i18n";
import { cn } from "@/lib/utils";

const AdminI18nContext = React.createContext<AdminI18n>(createAdminI18n("en"));

/**
 * Hands the admin language to client components and points the whole
 * document (dialogs and toasts portal to <body>) at its direction.
 */
export function AdminI18nProvider({ locale, children }: { locale: AdminLocale; children: React.ReactNode }) {
  const value = React.useMemo(() => createAdminI18n(locale), [locale]);

  React.useEffect(() => {
    const html = document.documentElement;
    const before = { lang: html.lang, dir: html.dir };
    html.lang = locale;
    html.dir = value.dir;
    return () => {
      html.lang = before.lang;
      html.dir = before.dir;
    };
  }, [locale, value.dir]);

  return <AdminI18nContext.Provider value={value}>{children}</AdminI18nContext.Provider>;
}

/** `{ t, locale, dir, money, price, date, number }` for the current admin language. */
export function useAdminI18n() {
  return React.useContext(AdminI18nContext);
}

function useSetLocale() {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const set = (next: AdminLocale) => {
    document.cookie = `${ADMIN_LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  };
  return { set, pending };
}

const LANGS: { value: AdminLocale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "fa", label: "فارسی" },
];

/** Two-option switch for the sidebar. Each language is named in its own script. */
export function LanguageSwitch({ className }: { className?: string }) {
  const { locale, t } = useAdminI18n();
  const { set, pending } = useSetLocale();

  return (
    <div
      role="group"
      aria-label={t("Panel language")}
      className={cn("flex items-center gap-1 rounded-[10px] bg-black-iron/[0.04] p-1", pending && "opacity-60", className)}
    >
      <Languages className="mx-1.5 h-4 w-4 shrink-0 text-dark-grey" strokeWidth={1.6} aria-hidden />
      {LANGS.map((l) => {
        const active = l.value === locale;
        return (
          <button
            key={l.value}
            type="button"
            lang={l.value}
            dir={l.value === "fa" ? "rtl" : "ltr"}
            aria-pressed={active}
            disabled={pending}
            onClick={() => !active && set(l.value)}
            className={cn(
              "h-8 flex-1 rounded-[8px] text-[13px] transition-colors",
              active
                ? "bg-white font-medium text-black-iron shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                : "text-dark-grey hover:text-black-iron",
            )}
          >
            {l.label}
          </button>
        );
      })}
    </div>
  );
}

/** Compact button for the phone bar: names the language you'd switch *to*. */
export function LanguageToggle({ className }: { className?: string }) {
  const { locale, t } = useAdminI18n();
  const { set, pending } = useSetLocale();
  const other = LANGS.find((l) => l.value !== locale)!;

  return (
    <button
      type="button"
      onClick={() => set(other.value)}
      disabled={pending}
      aria-label={t("Switch panel language to {lang}", { lang: other.label })}
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 px-2 text-[13px] text-dark-grey hover:text-black-iron disabled:opacity-60",
        className,
      )}
    >
      <Languages className="h-4 w-4" strokeWidth={1.6} aria-hidden />
      <span lang={other.value}>{other.label}</span>
    </button>
  );
}
