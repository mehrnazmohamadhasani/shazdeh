"use client";
import * as React from "react";
import { Camera, ChefHat, FileUp, Loader2, Plus, ReceiptText, ShoppingBag } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAdminI18n } from "@/components/admin/i18n";
import { useDocumentUpload, type DocumentKind } from "@/components/admin/ops/upload-button";
import { cn } from "@/lib/utils";

/*
 * The Today screen's one "Add" button. On a phone it sits at the bottom,
 * where the thumb is; on a computer it is in the page header. It opens a
 * sheet: what is it (supplier invoice, platform receipt, recipe photo),
 * then take a photo with the camera or pick photos / PDFs. While reading,
 * the button itself shows the progress.
 */

const KINDS: { kind: DocumentKind; label: string; hint: string; icon: typeof ReceiptText }[] = [
  { kind: "supplier_invoice", label: "Supplier invoice", hint: "Purchases, cash receipts, statements", icon: ReceiptText },
  { kind: "platform_order", label: "Platform receipt", hint: "talabat, Careem, Deliveroo, Noon", icon: ShoppingBag },
  { kind: "recipe", label: "Recipe photo", hint: "A recipe sheet from the kitchen", icon: ChefHat },
];

export function AddSheet({ canAddRecipes }: { canAddRecipes: boolean }) {
  const { t } = useAdminI18n();
  const [open, setOpen] = React.useState(false);
  const { busy, progressLabel, send } = useDocumentUpload();
  const camera = React.useRef<HTMLInputElement>(null);
  const files = React.useRef<HTMLInputElement>(null);
  const picking = React.useRef<DocumentKind>("supplier_invoice");
  const kinds = KINDS.filter((k) => canAddRecipes || k.kind !== "recipe");

  function pick(kind: DocumentKind, from: "camera" | "files") {
    picking.current = kind;
    setOpen(false);
    (from === "camera" ? camera : files).current?.click();
  }

  const onPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (picked.length) void send(picking.current, picked);
  };

  const label = progressLabel ?? t("Add");
  const icon = busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" strokeWidth={2.2} />;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} onChange={onPicked} />
      <input ref={files} type="file" multiple accept="image/*,application/pdf" className="sr-only" tabIndex={-1} onChange={onPicked} />

      {/* Computer: in the page header. */}
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen(true)}
        className="hidden h-12 items-center gap-2 rounded-pill bg-terracotta px-6 text-[14px] font-semibold text-white transition-colors hover:bg-terracotta-ink disabled:opacity-70 lg:inline-flex"
      >
        {icon}
        {label}
      </button>

      {/* Phone: fixed at the bottom, full width, above the home bar. */}
      <div data-add-bar className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-warm-white via-warm-white/95 to-warm-white/0 px-[max(1rem,var(--safe-left))] pb-[max(1rem,var(--safe-bottom))] pt-6 lg:hidden print:hidden">
        <button
          type="button"
          disabled={busy}
          onClick={() => setOpen(true)}
          className="flex h-16 w-full items-center justify-center gap-2.5 rounded-[20px] bg-terracotta text-[17px] font-semibold text-white shadow-[0_10px_30px_-10px_rgba(160,70,40,0.6)] active:scale-[0.99] disabled:opacity-80"
        >
          {icon}
          {label}
        </button>
      </div>

      <DialogContent className="bg-white sm:max-w-md">
        <DialogTitle className="px-5 pt-6 text-[20px] font-bold tracking-[-0.02em]">{t("Add")}</DialogTitle>
        <DialogDescription className="px-5 pt-1 text-[14px] text-dark-grey">{t("What is it? The photo is read for you to check.")}</DialogDescription>
        <ul className="space-y-3 px-4 pb-[max(1.25rem,var(--safe-bottom))] pt-4">
          {kinds.map(({ kind, label, hint, icon: Icon }) => (
            <li key={kind} className="rounded-[16px] border border-black-iron/[0.08] p-3">
              <p className="flex items-center gap-3 px-1">
                <Icon className="h-5 w-5 shrink-0 text-terracotta-ink" strokeWidth={1.7} />
                <span className="min-w-0">
                  <span className="block text-[15.5px] font-semibold">{t(label)}</span>
                  <span className="block truncate text-[12.5px] text-dark-grey">{t(hint)}</span>
                </span>
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <SheetButton primary onClick={() => pick(kind, "camera")} icon={<Camera className="h-[18px] w-[18px]" />}>
                  {t("Take photo")}
                </SheetButton>
                <SheetButton onClick={() => pick(kind, "files")} icon={<FileUp className="h-[18px] w-[18px]" />}>
                  {t("Photos or PDF")}
                </SheetButton>
              </div>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function SheetButton({ primary, onClick, icon, children }: { primary?: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-[12px] px-3 text-[14px] font-medium",
        primary ? "bg-terracotta text-white active:bg-terracotta-ink" : "bg-black-iron/[0.05] text-black-iron active:bg-black-iron/[0.09]",
      )}
    >
      {icon}
      {children}
    </button>
  );
}
