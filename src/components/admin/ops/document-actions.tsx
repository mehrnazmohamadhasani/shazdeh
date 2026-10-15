"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { messageFromUnknown } from "@/lib/error-message";
import { useAdminI18n } from "@/components/admin/i18n";

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

/** Mark a credit invoice as paid today (or another day), by whom. */
export function MarkPaidButton({ invoiceId, size = "sm" }: { invoiceId: string; size?: "sm" | "md" }) {
  const { t } = useAdminI18n();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [paidOn, setPaidOn] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [paidBy, setPaidBy] = React.useState("");
  const [note, setNote] = React.useState("");
  if (!open) {
    return (
      <Button size={size} variant="outline" onClick={() => setOpen(true)}>
        {t("Mark paid")}
      </Button>
    );
  }
  const control = "h-10 rounded-[10px] border border-black-iron/[0.12] bg-white px-3 text-[14px]";
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await postJson(`/api/admin/ops/invoices/${invoiceId}/pay`, { paidOn, paidBy: paidBy.trim() || null, note: note.trim() || null });
          toast.success(t("Marked as paid"));
          router.refresh();
        } catch (err) {
          toast.error(t(messageFromUnknown(err, "Could not save")));
          setBusy(false);
        }
      }}
    >
      <input aria-label={t("Paid on")} type="date" required value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className={control} />
      <input aria-label={t("Paid by")} placeholder={t("Paid by (Owner…)")} dir="auto" value={paidBy} onChange={(e) => setPaidBy(e.target.value)} className={`${control} w-40`} />
      <input aria-label={t("Note")} placeholder={t("Note (transfer ref…)")} dir="auto" value={note} onChange={(e) => setNote(e.target.value)} className={`${control} w-44`} />
      <Button size="sm" type="submit" disabled={busy}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {t("Save")}
      </Button>
      <Button size="sm" variant="ghost" type="button" onClick={() => setOpen(false)}>
        {t("Cancel")}
      </Button>
    </form>
  );
}
