import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { Wordmark } from "@/components/brand/wordmark";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const sp = await searchParams;

  return (
    <div className="relative min-h-screen grid lg:grid-cols-2 overflow-hidden bg-warm-white">
      <div
        aria-hidden
        className="hidden lg:block relative overflow-hidden bg-black-iron"
        style={{
          backgroundImage: "url(/menu/zafaran.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black-iron/30 via-transparent to-black-iron/40" />
      </div>

      <div className="relative flex flex-col items-center justify-center p-6 md:p-12 bg-warm-white">
        <div className="w-full max-w-sm">
          <Wordmark size="md" />
          <h1 className="mt-10 text-[30px] font-bold leading-tight tracking-[-0.03em] text-black-iron">Sign in</h1>

          <div className="mt-8">
            <LoginForm redirectTo={safeAdminPath(sp.from)} />
          </div>

        </div>
      </div>
    </div>
  );
}

/** Only ever return to an admin path — never an external URL. */
function safeAdminPath(from: string | string[] | undefined) {
  if (typeof from !== "string" || !from.startsWith("/admin") || from.startsWith("//")) {
    return "/admin";
  }
  return from;
}
