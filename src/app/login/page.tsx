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
  searchParams: Promise<{ from?: string }>;
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
        <div className="absolute inset-0 bg-gradient-to-b from-black-iron/40 via-black-iron/55 to-black-iron" />
        <div className="absolute top-12 left-12 right-12">
          <Wordmark size="sm" className="text-warm-white" />
        </div>
        <div className="absolute bottom-12 left-12 right-12 max-w-md text-warm-white">
          <p className="text-[10px] tracking-[0.32em] uppercase text-terracotta">
            The Atelier
          </p>
          <h2 className="mt-5 font-bold text-4xl tracking-[-0.04em] leading-[0.96]">
            Quietly manage
            <br />
            the brand.
          </h2>
          <p className="mt-5 text-warm-white/65 text-[14px] font-light leading-[1.6]">
            Every plate, every image, every word that lives on the SHĀZDEH
            table.
          </p>
        </div>
      </div>

      <div className="relative flex flex-col items-center justify-center p-6 md:p-12 bg-warm-white">
        <div className="w-full max-w-sm">
          <Wordmark size="sm" className="text-black-iron" />
          <h1 className="mt-12 font-bold text-4xl md:text-5xl text-black-iron leading-[0.96] tracking-[-0.04em]">
            Welcome back.
          </h1>
          <p className="mt-4 text-black-iron/55 text-[14px] font-light">
            Sign in to manage the SHĀZDEH experience.
          </p>

          <div className="mt-10">
            <LoginForm redirectTo={sp.from ?? "/admin"} />
          </div>

          <p className="mt-12 text-[10px] tracking-[0.32em] uppercase text-black-iron/45">
            © {new Date().getFullYear()} SHĀZDEH · Dubai
          </p>
        </div>
      </div>
    </div>
  );
}
