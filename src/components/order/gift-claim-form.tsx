"use client";
import * as React from "react";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeMobile } from "@/lib/ordering/phone";
import { savedContact, type SavedContact } from "@/components/order/cart-store";

/*
 * Claim a QR gift: mobile + email. It works right away — checkout applies
 * it by itself for this mobile — and the email is a reminder. Details
 * already saved on this device (from an earlier website order) are filled in.
 */
const noSubscribe = () => () => {};

export function GiftClaimForm({ code, offer }: { code: string; offer: string }) {
  // Read after hydration (the server has no saved details); the form
  // re-mounts once with them filled in.
  const saved = React.useSyncExternalStore(noSubscribe, () => JSON.stringify(savedContact.get()), () => "null");
  return <ClaimForm key={saved} code={code} offer={offer} saved={JSON.parse(saved) as SavedContact | null} />;
}

function ClaimForm({ code, offer, saved }: { code: string; offer: string; saved: SavedContact | null }) {
  const [name, setName] = React.useState(saved?.name ?? "");
  const [phone, setPhone] = React.useState(saved?.phone ?? "");
  const [email, setEmail] = React.useState(saved?.email ?? "");
  const [marketing, setMarketing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showErrors, setShowErrors] = React.useState(false);
  const [done, setDone] = React.useState<{ email: string; emailSent: boolean } | null>(null);

  const errors = {
    phone: !normalizeMobile(phone) ? "Enter your mobile number. Not a UAE number? Start with your country code, e.g. +44." : null,
    email: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? "Enter your email — your gift is sent there." : null,
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setShowErrors(true);
    setError(null);
    if (errors.phone || errors.email) return;
    setBusy(true);
    try {
      const res = await fetch("/api/gift/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name: name.trim() || null, phone, email: email.trim(), marketingOptIn: marketing }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Something went wrong. Please try again.");
      setDone({ email: json.email, emailSent: json.emailSent });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mt-8 rounded-[16px] border border-black-iron/10 bg-white/60 p-6 text-center" role="status">
        <Check className="mx-auto h-8 w-8 text-olive-leaf" strokeWidth={1.75} />
        <h2 className="mt-3 text-[1.25rem] font-bold tracking-[-0.02em]">Your gift is ready</h2>
        <p className="mt-2 text-[14px] text-dark-grey">
          {offer} is applied by itself at checkout when you order on our website with this mobile number.
          {done.emailSent && (
            <>
              {" "}We also sent it to <strong className="text-black-iron">{done.email}</strong>.
            </>
          )}
        </p>
        <Link href="/order" className="mt-5 flex h-12 items-center justify-center rounded-pill bg-terracotta text-[14px] font-semibold text-warm-white">
          Order now
        </Link>
        <button type="button" onClick={() => setDone(null)} className="mt-2 min-h-11 text-[13px] text-dark-grey underline">
          Change my details
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="mt-8 space-y-4">
      <Input label="Name" optional value={name} onChange={setName} autoComplete="name" />
      <Input
        label="Mobile number"
        value={phone}
        onChange={setPhone}
        error={showErrors ? errors.phone : null}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="050 123 4567"
        hint="Use this number when you order — that's how we know it's you."
      />
      <Input
        label="Email"
        value={email}
        onChange={setEmail}
        error={showErrors ? errors.email : null}
        type="email"
        inputMode="email"
        autoComplete="email"
        hint="We email you the gift."
      />
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[13.5px]">
        <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="h-5 w-5 shrink-0 accent-terracotta" />
        Send me SHĀZDEH news and offers now and then
      </label>
      {error && <p className="text-[13px] text-rose-sumac">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-pill bg-terracotta text-[14px] font-semibold text-warm-white disabled:opacity-60"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} Get my gift
      </button>
    </form>
  );
}

function Input({
  label,
  value,
  onChange,
  error,
  hint,
  optional,
  ...input
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
  hint?: string;
  optional?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const id = React.useId();
  return (
    <div>
      <label htmlFor={id} className="flex items-baseline justify-between text-[12.5px] font-medium">
        {label}
        {optional && <span className="text-[11.5px] font-normal text-dark-grey">Optional</span>}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error || hint ? `${id}-d` : undefined}
        className={cn(
          "mt-1.5 h-12 w-full rounded-[10px] border bg-white/60 px-3.5 text-[15px] focus:outline-none focus:ring-1",
          error ? "border-rose-sumac focus:ring-rose-sumac/40" : "border-black-iron/15 focus:border-terracotta/60 focus:ring-terracotta/40",
        )}
        {...input}
      />
      {(error || hint) && (
        <p id={`${id}-d`} className={cn("mt-1 text-[12px]", error ? "text-rose-sumac" : "text-dark-grey")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
