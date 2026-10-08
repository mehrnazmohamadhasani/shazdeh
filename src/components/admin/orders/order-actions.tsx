"use client";
import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/* Shared staff actions: status changes, reject/cancel with a reason, dispatch details. */

export async function patchOrder(id: string, body: unknown): Promise<boolean> {
  try {
    const res = await fetch(`/api/admin/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      toast.error(err?.error ?? "Couldn't update the order");
      return false;
    }
    return true;
  } catch {
    toast.error("Connection problem — try again");
    return false;
  }
}

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
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-theme="dark" className="bg-black-iron text-warm-white sm:max-w-md">
        <div className="p-6">
          <DialogTitle className="text-2xl text-warm-white">{title}</DialogTitle>
          <DialogDescription className="mt-2 text-warm-white/60">The customer sees this reason.</DialogDescription>
          <div className="mt-5 flex flex-wrap gap-2">
            {REJECT_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={cn(
                  "min-h-10 rounded-full border px-3.5 text-[12.5px]",
                  reason === r ? "border-terracotta bg-terracotta/20 text-warm-white" : "border-warm-white/15 text-warm-white/75",
                )}
              >
                {r}
              </button>
            ))}
          </div>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className="mt-3 min-h-[80px]"
            placeholder="Or write a short reason"
            maxLength={300}
          />
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Back
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
  const [provider, setProvider] = React.useState(providers[0]?.id ?? "own_fleet");
  const [driverName, setDriverName] = React.useState("");
  const [driverPhone, setDriverPhone] = React.useState("");
  const [deliveryRef, setDeliveryRef] = React.useState("");
  const [trackingUrl, setTrackingUrl] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-theme="dark" className="bg-black-iron text-warm-white sm:max-w-md">
        <div className="space-y-4 p-6">
          <DialogTitle className="text-2xl text-warm-white">Dispatch order</DialogTitle>
          <DialogDescription className="text-warm-white/60">
            Optional details. The customer sees the rider&apos;s first name and any courier tracking link.
          </DialogDescription>
          {providers.length > 1 && (
            <div className="grid grid-cols-2 gap-2">
              {providers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProvider(p.id)}
                  className={cn(
                    "min-h-12 rounded-md border px-3 text-left text-[13px]",
                    provider === p.id ? "border-terracotta bg-terracotta/15" : "border-warm-white/15",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Rider name</Label>
              <Input value={driverName} onChange={(e) => setDriverName(e.target.value)} maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <Label>Rider phone</Label>
              <Input value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} inputMode="tel" maxLength={40} />
            </div>
          </div>
          {provider === "courier" && (
            <>
              <div className="space-y-1.5">
                <Label>Courier booking reference</Label>
                <Input value={deliveryRef} onChange={(e) => setDeliveryRef(e.target.value)} maxLength={120} />
              </div>
              <div className="space-y-1.5">
                <Label>Courier tracking link</Label>
                <Input value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} placeholder="https://…" maxLength={500} />
              </div>
            </>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Back
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
              Send out
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Two soft tones — loud enough for a kitchen, no audio file needed. */
export function playChime(ctx: AudioContext | null) {
  if (!ctx) return;
  const now = ctx.currentTime;
  [880, 1320].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now + i * 0.22);
    gain.gain.exponentialRampToValueAtTime(0.35, now + i * 0.22 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.22 + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + i * 0.22);
    osc.stop(now + i * 0.22 + 0.55);
  });
}
