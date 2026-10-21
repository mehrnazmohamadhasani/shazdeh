"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Banknote, Building2, Camera, Check, CreditCard, FilePlus2, Landmark, Loader2, Paperclip, Pencil, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { StatusPill } from "@/components/admin/ui";
import { cn } from "@/lib/utils";
import { messageFromUnknown } from "@/lib/error-message";
import { useAdminI18n } from "@/components/admin/i18n";
import { RECEIPT_LABEL, type ReceiptKind } from "./payment-labels";

export function RetryRead({ documentId }: { documentId: string }) {
  const { t } = useAdminI18n();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await fetch(`/api/admin/ops/documents/${documentId}/read`, { method: "POST" });
          if (!res.ok) throw await res.json().catch(() => ({}));
          router.refresh();
        } catch (e) {
          toast.error(t(messageFromUnknown(e, "Could not read again")));
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
      {t("Read again")}
    </Button>
  );
}

export function DiscardButton({ documentId, label, redirectTo = "/admin/ops/invoices" }: { documentId: string; label?: string; redirectTo?: string }) {
  const { t } = useAdminI18n();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await fetch(`/api/admin/ops/documents/${documentId}/discard`, { method: "POST" });
          if (!res.ok) throw await res.json().catch(() => ({}));
          router.push(redirectTo);
          router.refresh();
        } catch (e) {
          toast.error(t(messageFromUnknown(e, "Could not discard")));
          setBusy(false);
        }
      }}
    >
      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
      {label ?? t("Discard")}
    </Button>
  );
}

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw json;
  return json;
}

/**
 * Edit a saved invoice: it opens again on the review screen with what was
 * saved, ready to correct. Its stock stops counting until it is saved
 * again (or discarded, to remove it completely).
 */
export function EditInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const { t } = useAdminI18n();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={async () => {
        if (!window.confirm(t("Edit this invoice? Its stock stops counting until you save it again."))) return;
        setBusy(true);
        try {
          await postJson(`/api/admin/ops/invoices/${invoiceId}/edit`, {});
          router.refresh();
        } catch (e) {
          toast.error(t(messageFromUnknown(e, "Could not open the invoice for editing")));
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
      {t("Edit")}
    </Button>
  );
}

export type PaymentMethod = "cash" | "card" | "transfer" | "credit";
const METHOD = {
  cash: { label: "Cash", icon: Banknote },
  card: { label: "Card", icon: CreditCard },
  transfer: { label: "Bank transfer", icon: Landmark },
  credit: { label: "On account", icon: Building2 },
} as const;

/** The receipt most likely for a method, until someone picks another. */
const RECEIPT_FOR: Record<PaymentMethod, ReceiptKind> = { cash: "card", card: "card", transfer: "bank", credit: "bank" };

const field = "mt-1 h-11 w-full rounded-[10px] border border-black-iron/[0.12] bg-white px-3 text-[14px] text-black-iron";
const choice = (on: boolean) =>
  cn(
    "flex min-h-11 items-center justify-center gap-2 rounded-[12px] border px-3 text-center text-[13.5px] font-medium transition-colors",
    on ? "border-terracotta bg-terracotta/[0.07] text-terracotta-ink" : "border-black-iron/[0.1] text-black-iron",
  );

/**
 * An invoice's payment at a glance — method and paid / unpaid — and, for
 * those who may record payments, a tap opens the Payment box: method,
 * a "Paid" tick, the day, who paid and with whose money, and a photo of
 * the receipt.
 */
export function InvoicePayment({
  invoiceId,
  method,
  paidAt,
  paidBy,
  personal: paidPersonally = false,
  receiptId = null,
  receiptKind = null,
  dueDate,
  canEdit,
}: {
  invoiceId: string;
  method: PaymentMethod | null;
  paidAt: string | null;
  paidBy: string | null;
  personal?: boolean;
  receiptId?: string | null;
  receiptKind?: ReceiptKind | null;
  dueDate: string | null;
  canEdit: boolean;
}) {
  const { t, date } = useAdminI18n();
  const router = useRouter();
  // Read once (Dubai day); a render must not read the clock.
  const [today] = React.useState(() => new Date(Date.now() + 4 * 3_600_000).toISOString().slice(0, 10));
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [m, setM] = React.useState<PaymentMethod>(method ?? "cash");
  const [paid, setPaid] = React.useState(!!paidAt);
  const [paidOn, setPaidOn] = React.useState(paidAt ? new Date(new Date(paidAt).getTime() + 4 * 3_600_000).toISOString().slice(0, 10) : today);
  const [by, setBy] = React.useState(paidBy ?? "");
  const [personal, setPersonal] = React.useState(paidPersonally);
  const [kind, setKind] = React.useState<ReceiptKind | null>(receiptKind);
  const [file, setFile] = React.useState<File | null>(null);
  const [removed, setRemoved] = React.useState(false);
  const fileInput = React.useRef<HTMLInputElement>(null);
  const overdue = !paidAt && dueDate && new Date(new Date(dueDate).getTime() + 4 * 3_600_000).toISOString().slice(0, 10) < today;
  const short = (d: string) => date(d, { day: "numeric", month: "short" });
  const hasReceipt = !!file || (!!receiptId && !removed);
  const needsName = paid && personal && !by.trim();

  // Method on top, then who paid / the receipt; the status on the right,
  // so the pill sits in the same place on every row.
  const detail = [
    paidAt && paidBy ? (paidPersonally ? t("{name}'s own money", { name: paidBy }) : t("by {name}", { name: paidBy })) : null,
    receiptId ? t("Receipt attached") : null,
  ].filter(Boolean);
  const summary = (
    <span className="flex w-full min-w-0 items-center gap-3 text-start">
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-[13.5px]", method ? "text-black-iron" : "text-dark-grey")}>
          {method ? t(METHOD[method].label) : t("Method not set")}
        </span>
        {detail.length > 0 && (
          <span dir="auto" className="flex items-center gap-1 truncate text-[12px] text-dark-grey">
            {receiptId && <Paperclip className="h-3 w-3 shrink-0" />}
            <span className="truncate">{detail.join(" · ")}</span>
          </span>
        )}
      </span>
      {paidAt ? (
        <StatusPill tone="good">
          <Check className="h-3 w-3" /> {t("Paid")}
        </StatusPill>
      ) : (
        <StatusPill tone={overdue ? "bad" : "warn"}>
          {dueDate ? t(overdue ? "Overdue {date}" : "Due {date}", { date: short(dueDate) }) : t("Not paid")}
        </StatusPill>
      )}
    </span>
  );
  if (!canEdit) return <div className="flex min-h-12 w-full items-center px-3">{summary}</div>;

  function start() {
    // Open with what is saved, not with a draft left from a cancelled edit.
    setM(method ?? "cash");
    setPaid(!!paidAt);
    setBy(paidBy ?? "");
    setPersonal(paidPersonally);
    setKind(receiptKind);
    setFile(null);
    setRemoved(false);
    setOpen(true);
  }

  async function save() {
    setBusy(true);
    try {
      const form = new FormData();
      form.set(
        "payment",
        JSON.stringify({
          method: m,
          paid,
          paidOn: paid ? paidOn : null,
          paidBy: paid ? by.trim() || null : null,
          personal: paid && personal,
          receiptKind: hasReceipt ? (kind ?? RECEIPT_FOR[m]) : null,
          removeReceipt: removed && !file,
        }),
      );
      if (paid && file) form.set("receipt", file);
      const res = await fetch(`/api/admin/ops/invoices/${invoiceId}/payment`, { method: "POST", body: form });
      if (!res.ok) throw await res.json().catch(() => ({}));
      toast.success(t("Payment saved"));
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(t(messageFromUnknown(e, "Could not save")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          start();
        }}
        // Looks like a control: a bordered box with an edit icon, a clear hover and focus ring.
        className="group flex w-full min-h-12 items-center gap-2 rounded-[12px] border border-black-iron/[0.1] bg-white px-3 py-1.5 transition-colors hover:border-terracotta/50 hover:bg-terracotta/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/40"
        title={t("Edit payment")}
      >
        <span className="sr-only">{t("Edit payment")}: </span>
        {summary}
        <Pencil className="h-3.5 w-3.5 shrink-0 text-dark-grey transition-colors group-hover:text-terracotta-ink" aria-hidden />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto bg-white sm:max-w-md">
          <DialogTitle className="px-5 pt-6 text-[20px] font-bold tracking-[-0.02em]">{t("Payment")}</DialogTitle>
          <DialogDescription className="px-5 pt-1 text-[14px] text-dark-grey">{t("How this invoice is paid, and whether it is paid.")}</DialogDescription>
          <div className="space-y-4 px-5 pb-[max(1.25rem,var(--safe-bottom))] pt-4">
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("Payment method")}>
              {(Object.keys(METHOD) as PaymentMethod[]).map((k) => {
                const Icon = METHOD[k].icon;
                return (
                  <button key={k} type="button" role="radio" aria-checked={m === k} onClick={() => setM(k)} className={cn(choice(m === k), "h-12")}>
                    <Icon className="h-4 w-4" /> {t(METHOD[k].label)}
                  </button>
                );
              })}
            </div>
            <label className="flex min-h-12 items-center gap-3 rounded-[12px] border border-black-iron/[0.1] px-4 text-[15px] font-medium">
              <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="h-5 w-5 accent-terracotta" />
              {t("Paid")}
            </label>
            {paid && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[12.5px] text-dark-grey">
                    {t("Paid on")}
                    <input type="date" max={today} value={paidOn} onChange={(e) => setPaidOn(e.target.value || today)} className={field} />
                  </label>
                  <label className="text-[12.5px] text-dark-grey">
                    {t("Paid by")}
                    <input
                      dir="auto"
                      value={by}
                      onChange={(e) => setBy(e.target.value.slice(0, 80))}
                      placeholder={t("Owner, staff name…")}
                      aria-invalid={needsName}
                      className={cn(field, needsName && "border-pomegranate-red")}
                    />
                  </label>
                </div>

                <div>
                  <p className="text-[12.5px] text-dark-grey">{t("Whose money?")}</p>
                  <div className="mt-1 grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("Whose money?")}>
                    <button type="button" role="radio" aria-checked={!personal} onClick={() => setPersonal(false)} className={choice(!personal)}>
                      {t("The business's")}
                    </button>
                    <button type="button" role="radio" aria-checked={personal} onClick={() => setPersonal(true)} className={choice(personal)}>
                      {t("Their own")}
                    </button>
                  </div>
                  {personal && (
                    <p className="mt-1.5 text-[12.5px] text-dark-grey">
                      {needsName ? t("Write who paid, above.") : t("The business owes this back to {name}. It shows in Owner cash.", { name: by.trim() })}
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-[12.5px] text-dark-grey">{t("Payment receipt (optional)")}</p>
                  <div className="mt-1 grid grid-cols-3 gap-2" role="radiogroup" aria-label={t("Receipt type")}>
                    {(Object.keys(RECEIPT_LABEL) as ReceiptKind[]).map((k) => {
                      const on = (kind ?? RECEIPT_FOR[m]) === k;
                      return (
                        <button key={k} type="button" role="radio" aria-checked={on} onClick={() => setKind(k)} className={choice(on)}>
                          {t(RECEIPT_LABEL[k])}
                        </button>
                      );
                    })}
                  </div>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setFile(f);
                      e.target.value = "";
                    }}
                  />
                  <div className="mt-2 flex min-h-11 items-center gap-2 rounded-[12px] border border-dashed border-black-iron/[0.15] px-3">
                    {hasReceipt ? (
                      <>
                        <Paperclip className="h-4 w-4 shrink-0 text-dark-grey" />
                        {file ? (
                          <span dir="auto" className="min-w-0 flex-1 truncate text-[13.5px] text-black-iron">
                            {file.name}
                          </span>
                        ) : (
                          <a
                            href={`/api/admin/ops/documents/${receiptId}/file`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-terracotta-ink admin-link"
                          >
                            {t("View receipt")}
                          </a>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => fileInput.current?.click()}>
                          {t("Edit")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-pomegranate-red hover:bg-pomegranate-red/[0.08]"
                          onClick={() => {
                            setFile(null);
                            setRemoved(true);
                          }}
                        >
                          {t("Delete")}
                        </Button>
                      </>
                    ) : (
                      <button type="button" onClick={() => fileInput.current?.click()} className="flex flex-1 items-center gap-2 py-2 text-[13.5px] font-medium text-black-iron">
                        <Camera className="h-4 w-4 text-dark-grey" /> {t("Add receipt photo")}
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
            {m === "credit" && !paid && <p className="text-[12.5px] text-dark-grey">{t("On account: it stays in Unpaid until you tick Paid.")}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="md" onClick={() => setOpen(false)}>
                {t("Cancel")}
              </Button>
              <Button size="md" disabled={busy || needsName} onClick={save}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {t("Save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Starts an invoice typed in by hand (no photo) and opens it on the usual review screen. */
export function ManualInvoiceButton() {
  const { t } = useAdminI18n();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      size="md"
      variant="outline"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await fetch("/api/admin/ops/invoices/manual", { method: "POST" });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) throw body;
          router.push(`/admin/ops/invoices/${body.id}`);
        } catch (e) {
          toast.error(t(messageFromUnknown(e, "Could not save")));
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus2 className="h-4 w-4" />}
      {t("New invoice")}
    </Button>
  );
}
