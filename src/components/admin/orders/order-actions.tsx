"use client";
import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useAdminI18n } from "@/components/admin/i18n";
import type { Translate } from "@/lib/admin-i18n";

/* Shared staff actions: status changes, reject/cancel with a reason, dispatch details. */

/** Pass the screen's `t` so the error toast is in the panel language. */
export async function patchOrder(id: string, body: unknown, t: Translate = (s) => s): Promise<boolean> {
  try {
    const res = await fetch(`/api/admin/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      toast.error(t(err?.error ?? "Couldn't update the order"));
      return false;
    }
    return true;
  } catch {
    toast.error(t("Connection problem — try again"));
    return false;
  }
}

/*
 * Preset reasons are stored on the order and shown to the customer, so the
 * value sent stays English; staff see the button label in their language.
 */
const REJECT_REASONS = [
  "Kitchen is too busy right now",
  "An item is sold out",
  "Address is outside our delivery area",
  "Couldn't reach the customer",
];

export function ReasonDialog({
  open,
  onOpenChange,
  title,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  confirmLabel: string;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const { t } = useAdminI18n();
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white text-black-iron sm:max-w-md">
        <div className="p-6">
          <DialogTitle className="text-2xl text-black-iron">{title}</DialogTitle>
          <DialogDescription className="mt-2 text-dark-grey">{t("The customer sees this reason.")}</DialogDescription>
          <div className="mt-5 flex flex-wrap gap-2">
            {REJECT_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={cn(
                  "min-h-10 rounded-full border px-3.5 text-[12.5px]",
                  reason === r ? "border-terracotta bg-terracotta/20 text-black-iron" : "border-black-iron/15 text-black-iron/80",
                )}
              >
                {t(r)}
              </button>
            ))}
          </div>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            dir="auto"
            className="mt-3 min-h-[80px]"
            placeholder={t("Or write a short reason")}
            maxLength={300}
          />
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t("Back")}
            </Button>
            <Button
              variant="destructive"
              disabled={!reason.trim() || busy}
              onClick={async () => {
                setBusy(true);
                await onConfirm(reason.trim());
                setBusy(false);
                setReason("");
              }}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {confirmLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type DispatchProviderOption = { id: string; label: string; description: string };

export function DispatchDialog({
  open,
  onOpenChange,
  providers,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  providers: DispatchProviderOption[];
  onConfirm: (d: { provider: string; driverName: string; driverPhone: string; deliveryRef: string; trackingUrl: string }) => Promise<void>;
}) {
  const { t } = useAdminI18n();
  const [provider, setProvider] = React.useState(providers[0]?.id ?? "own_fleet");
  const [driverName, setDriverName] = React.useState("");
  const [driverPhone, setDriverPhone] = React.useState("");
  const [deliveryRef, setDeliveryRef] = React.useState("");
  const [trackingUrl, setTrackingUrl] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white text-black-iron sm:max-w-md">
        <div className="space-y-4 p-6">
          <DialogTitle className="text-2xl text-black-iron">{t("Dispatch order")}</DialogTitle>
          <DialogDescription className="text-dark-grey">
            {t("Optional details. The customer sees the rider's first name and any courier tracking link.")}
          </DialogDescription>
          {providers.length > 1 && (
            <div className="grid grid-cols-2 gap-2">
              {providers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProvider(p.id)}
                  className={cn(
                    "min-h-12 rounded-md border px-3 text-start text-[13px]",
                    provider === p.id ? "border-terracotta bg-terracotta/15" : "border-black-iron/15",
                  )}
                >
                  {t(p.label)}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("Rider name")}</Label>
              <Input dir="auto" value={driverName} onChange={(e) => setDriverName(e.target.value)} maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Rider phone")}</Label>
              <Input dir="ltr" value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} inputMode="tel" maxLength={40} />
            </div>
          </div>
          {provider === "courier" && (
            <>
              <div className="space-y-1.5">
                <Label>{t("Courier booking reference")}</Label>
                <Input dir="ltr" value={deliveryRef} onChange={(e) => setDeliveryRef(e.target.value)} maxLength={120} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("Courier tracking link")}</Label>
                <Input dir="ltr" value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} placeholder="https://…" maxLength={500} />
              </div>
            </>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t("Back")}
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await onConfirm({ provider, driverName, driverPhone, deliveryRef, trackingUrl });
                setBusy(false);
              }}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("Send out")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
