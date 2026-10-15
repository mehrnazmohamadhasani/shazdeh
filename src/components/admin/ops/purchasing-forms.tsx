"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, SwitchRow, TextInput } from "@/components/admin/ui";
import { messageFromUnknown } from "@/lib/error-message";
import { useAdminI18n } from "@/components/admin/i18n";

async function send(url: string, method: "POST" | "PATCH", body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw json;
  return json;
}

const today = () => new Date().toISOString().slice(0, 10);

/** Cash taken from the business account to pay for purchases. */
export function WithdrawalForm({ people }: { people: string[] }) {
  const { t } = useAdminI18n();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [person, setPerson] = React.useState("Owner");
  const [amount, setAmount] = React.useState("");
  const [day, setDay] = React.useState(today);
  const [note, setNote] = React.useState("");
  return (
    <form
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_2fr_auto] lg:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        const value = Number(amount.replace(",", "."));
        if (!(value > 0)) return toast.error(t("Enter the amount taken."));
        setBusy(true);
        try {
          await send("/api/admin/ops/cash", "POST", { person: person.trim(), amount: value, day, note: note.trim() || null });
          toast.success(t("Withdrawal saved"));
          setAmount("");
          setNote("");
          router.refresh();
        } catch (err) {
          toast.error(t(messageFromUnknown(err, "Could not save")));
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label={t("Taken by")} required>
        <TextInput list="ops-cash-people" dir="auto" required value={person} onChange={(e) => setPerson(e.target.value)} />
        <datalist id="ops-cash-people">
          {[...new Set(["Owner", ...people])].map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </Field>
      <Field label={t("Amount (AED)")} required>
        <TextInput inputMode="decimal" dir="ltr" required value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <Field label={t("Date")} required>
        <TextInput type="date" required value={day} onChange={(e) => setDay(e.target.value)} />
      </Field>
      <Field label={t("Note")}>
        <TextInput dir="auto" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("e.g. ATM, bank transfer ref")} />
      </Field>
      <Button type="submit" disabled={busy}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {t("Add")}
      </Button>
    </form>
  );
}

export function VoidWithdrawalButton({ id }: { id: string }) {
  const { t } = useAdminI18n();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={busy}
      onClick={async () => {
        if (!window.confirm(t("Remove this withdrawal? Use this only for a mistake."))) return;
        setBusy(true);
        try {
          await send(`/api/admin/ops/cash/${id}/void`, "POST");
          toast.success(t("Removed"));
          router.refresh();
        } catch (err) {
          toast.error(t(messageFromUnknown(err, "Could not save")));
          setBusy(false);
        }
      }}
    >
      {t("Remove")}
    </Button>
  );
}

/** Food cost with or without VAT, and the monthly AI limit. */
export function OpsSettingsForm({
  initial,
}: {
  initial: { foodCostIncludesVat: boolean; aiMonthlyCapUsd: number; autoSavePlatform: boolean; autoSaveInvoices: boolean };
}) {
  const { t } = useAdminI18n();
  const router = useRouter();
  const [withVat, setWithVat] = React.useState(initial.foodCostIncludesVat);
  const [cap, setCap] = React.useState(String(initial.aiMonthlyCapUsd));
  const [autoPlatform, setAutoPlatform] = React.useState(initial.autoSavePlatform);
  const [autoInvoices, setAutoInvoices] = React.useState(initial.autoSaveInvoices);
  const [busy, setBusy] = React.useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const capValue = Number(cap.replace(",", "."));
        if (!(capValue >= 0)) return toast.error(t("Enter a monthly limit (0 or more)."));
        setBusy(true);
        try {
          await send("/api/admin/ops/settings", "PATCH", {
            foodCostIncludesVat: withVat,
            aiMonthlyCapUsd: capValue,
            autoSavePlatform: autoPlatform,
            autoSaveInvoices: autoInvoices,
          });
          toast.success(t("Saved"));
          router.refresh();
        } catch (err) {
          toast.error(t(messageFromUnknown(err, "Could not save")));
        } finally {
          setBusy(false);
        }
      }}
    >
      <SwitchRow
        label={t("Food cost includes VAT")}
        description={t(
          "Off: costs without VAT (SHĀZDEH gets purchase VAT back). On: costs with the VAT paid to suppliers. Recipes, stock prices and margins all follow this.",
        )}
        checked={withVat}
        onCheckedChange={setWithVat}
      />
      <SwitchRow
        label={t("Save clear platform receipts automatically")}
        description={t("Only when every dish is clearly matched to the menu and everything adds up. Anything else waits for a check.")}
        checked={autoPlatform}
        onCheckedChange={setAutoPlatform}
      />
      <SwitchRow
        label={t("Save clear supplier invoices automatically")}
        description={t("Only for a known supplier whose items were all confirmed before, printed (not handwritten), with every sum adding up.")}
        checked={autoInvoices}
        onCheckedChange={setAutoInvoices}
      />
      <Field label={t("Monthly AI limit (US$)")} hint={t("Reading stops for the rest of the month at this amount; admins get a warning at 80 %.")}>
        <TextInput inputMode="decimal" dir="ltr" value={cap} onChange={(e) => setCap(e.target.value)} className="max-w-40" />
      </Field>
      <Button type="submit" disabled={busy}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {t("Save")}
      </Button>
    </form>
  );
}

/** Purchase VAT for the accountant, as an Excel file, for a date range. */
export function VatExportForm() {
  const { t } = useAdminI18n();
  const first = React.useMemo(() => {
    const d = new Date();
    return new Date(Date.UTC(d.getFullYear(), d.getMonth() - 1, 1)).toISOString().slice(0, 10);
  }, []);
  const last = React.useMemo(() => {
    const d = new Date();
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), 0)).toISOString().slice(0, 10);
  }, []);
  const [from, setFrom] = React.useState(first);
  const [to, setTo] = React.useState(last);
  return (
    <div className="flex flex-wrap items-end gap-3">
      <Field label={t("From")}>
        <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
      </Field>
      <Field label={t("To")}>
        <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </Field>
      <Button asChild>
        <a href={`/api/admin/ops/vat-export?from=${from}&to=${to}`} download>
          <Download className="h-4 w-4" />
          {t("Download Excel")}
        </a>
      </Button>
    </div>
  );
}
