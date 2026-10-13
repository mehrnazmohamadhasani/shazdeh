"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RotateCw } from "lucide-react";
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

export function DiscardButton({ documentId, label }: { documentId: string; label?: string }) {
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
          router.push("/admin/ops/invoices");
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

/** Undo a saved invoice (asks why — the reason goes into the audit log). */
export function UndoInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const { t } = useAdminI18n();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={busy}
      className="text-pomegranate-red hover:bg-pomegranate-red/[0.08]"
      onClick={async () => {
        const reason = window.prompt(
          `${t("Undo this invoice? Its stock is taken back out and you can correct and save it again.")}\n\n${t("Why? (e.g. wrong quantity)")}`,
        );
        if (!reason?.trim()) return;
        setBusy(true);
        try {
          const result = await postJson(`/api/admin/ops/invoices/${invoiceId}/void`, { reason: reason.trim() });
          toast.success(
            result.reversed
              ? t(result.reversed > 1 ? "Undone — {n} stock entries reversed" : "Undone — {n} stock entry reversed", { n: result.reversed })
              : t("Undone"),
          );
          router.refresh();
        } catch (e) {
          toast.error(t(messageFromUnknown(e, "Could not undo")));
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
      {t("Undo invoice")}
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
