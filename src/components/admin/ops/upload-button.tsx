"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { messageFromUnknown } from "@/lib/error-message";
import { useAdminI18n } from "@/components/admin/i18n";
import type { Translate } from "@/lib/admin-i18n";

/*
 * One big button: on a phone it offers camera, photo library or files
 * (no `capture`, so a saved photo or PDF works too), and several can be
 * picked at once. Photos are shrunk to fit the upload limit and read
 * fast. A PDF with several pages is usually a stack of scanned invoices
 * (one per page), so it is split here, in the browser — which also keeps
 * each upload under the host's size limit. One file opens its reading;
 * several are read in turn and the list is shown.
 */

const MAX_SIDE = 2200;
const QUALITY = 0.85;

async function shrink(file: File): Promise<Blob> {
  if (file.type === "application/pdf") return file;
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not prepare the photo"))), "image/jpeg", QUALITY),
  );
}

/** Splits multi-page PDFs into one file per page, if the person says each page is an invoice. */
async function splitPdfs(files: File[], t: Translate): Promise<File[]> {
  const out: File[] = [];
  for (const file of files) {
    if (file.type !== "application/pdf") {
      out.push(file);
      continue;
    }
    const { PDFDocument } = await import("pdf-lib");
    const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
    const pages = src.getPageCount();
    if (
      pages < 2 ||
      !window.confirm(
        `${t("\"{name}\" has {n} pages.", { name: file.name, n: pages })}\n\n${t("OK — each page is a separate invoice")}\n${t("Cancel — all pages are one invoice")}`,
      )
    ) {
      out.push(file);
      continue;
    }
    const base = file.name.replace(/\.pdf$/i, "");
    for (let i = 0; i < pages; i++) {
      const one = await PDFDocument.create();
      const [page] = await one.copyPages(src, [i]);
      one.addPage(page);
      const bytes = await one.save();
      out.push(new File([bytes as BlobPart], `${base} p${i + 1}.pdf`, { type: "application/pdf" }));
    }
  }
  return out;
}

export function UploadButton({
  label,
  kind = "supplier_invoice",
  variant = "primary",
}: {
  label?: string;
  kind?: "supplier_invoice" | "recipe" | "platform_order";
  variant?: "primary" | "outline";
}) {
  const recipe = kind === "recipe";
  const sale = kind === "platform_order";
  const openPath = (id: string) => (recipe ? `/admin/ops/recipes/import/${id}` : sale ? `/admin/ops/sales/receipts/${id}` : `/admin/ops/invoices/${id}`);
  const { t } = useAdminI18n();
  const router = useRouter();
  const input = React.useRef<HTMLInputElement>(null);
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null);

  /** Uploads one file; returns the document id (existing one for a duplicate). */
  async function upload(file: File): Promise<{ id: string; duplicate: boolean }> {
    const blob = await shrink(file);
    const form = new FormData();
    const name = file.type === "application/pdf" ? file.name : file.name.replace(/\.\w+$/, "") + ".jpg";
    form.append("file", blob, name || (recipe ? "recipe.jpg" : sale ? "receipt.jpg" : "invoice.jpg"));
    form.append("kind", kind);
    const res = await fetch("/api/admin/ops/documents", { method: "POST", body: form });
    const body = await res.json().catch(() => ({}));
    if (res.status === 409 && body.id) return { id: body.id, duplicate: true };
    if (!res.ok) throw body;
    return { id: body.id, duplicate: false };
  }

  async function send(picked: File[]) {
    setProgress({ done: 0, total: picked.length });
    let files: File[];
    try {
      // A recipe PDF with several pages is one recipe; invoices and receipts may be one per page.
      files = recipe ? picked : await splitPdfs(picked, t);
    } catch (e) {
      toast.error(t(messageFromUnknown(e, "Could not open the PDF")));
      setProgress(null);
      return;
    }
    setProgress({ done: 0, total: files.length });
    // One photo: open it. Several: read them one after another, then show the list.
    if (files.length === 1) {
      try {
        const { id, duplicate } = await upload(files[0]);
        if (duplicate) toast.info(t("Already uploaded — opening it."));
        router.push(openPath(id));
        router.refresh();
      } catch (e) {
        toast.error(t(messageFromUnknown(e, "Upload failed")));
        setProgress(null);
      }
      return;
    }
    let ok = 0;
    let duplicates = 0;
    const failed: string[] = [];
    for (const [i, file] of files.entries()) {
      try {
        const r = await upload(file);
        if (r.duplicate) duplicates++;
        else ok++;
      } catch (e) {
        failed.push(`${file.name}: ${t(messageFromUnknown(e, "failed"))}`);
      }
      setProgress({ done: i + 1, total: files.length });
    }
    if (ok) toast.success(t("{n} read — check and save each one", { n: ok }));
    if (duplicates) toast.info(t("{n} already uploaded before", { n: duplicates }));
    if (failed.length) toast.error(failed.join("\n"));
    setProgress(null);
    router.push(recipe ? "/admin/ops/recipes" : sale ? "/admin/ops/sales" : "/admin/ops/invoices");
    router.refresh();
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        multiple
        accept="image/*,application/pdf"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) void send(files);
        }}
      />
      <Button size="md" variant={variant} disabled={!!progress} onClick={() => input.current?.click()}>
        {progress ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        {progress
          ? progress.total > 1
            ? t("Reading {done} of {total}…", { done: Math.min(progress.done + 1, progress.total), total: progress.total })
            : t("Reading… up to a minute")
          : (label ?? t("Add invoice"))}
      </Button>
    </>
  );
}
