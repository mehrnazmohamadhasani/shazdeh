"use client";
import * as React from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Upload, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { chipDangerClass } from "@/components/admin/ui";
import { messageFromUnknown } from "@/lib/error-message";
import { uploadAdminImage } from "@/lib/upload-admin-image";
import { useAdminI18n } from "@/components/admin/i18n";
import type { Translate } from "@/lib/admin-i18n";

/** Upload errors (from the browser check or the server) in the admin language. */
function uploadErrorText(msg: string, t: Translate) {
  let m = /^Image is too large \(max (\d+)MB\)\.$/.exec(msg);
  if (m) return t("Image is too large (max {max}MB).", { max: m[1] });
  m = /^Image is too large \((\d+)MB\)\. Compress to under (\d+)MB, /.exec(msg);
  if (m) return t("Image is too large ({size}MB). Compress it to under {max}MB and try again.", { size: m[1], max: m[2] });
  m = /^File too large \(max (\d+)MB on this host\)\./.exec(msg);
  if (m) return t("Image is too large (max {max}MB).", { max: m[1] });
  return t(msg);
}

export function ImageUploader({
  value,
  onChange,
  folder = "general",
  className,
  label,
  aspect = "video",
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  folder?: string;
  className?: string;
  label?: string;
  aspect?: "video" | "square" | "portrait";
}) {
  const { t, locale } = useAdminI18n();
  const [pending, setPending] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setPending(true);
    try {
      const data = await uploadAdminImage(file, folder);
      onChange(data.url);
      toast.success(t("Image uploaded"));
    } catch (e) {
      const msg = messageFromUnknown(e, "Upload failed");
      toast.error(locale === "fa" ? uploadErrorText(msg, t) : msg);
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const aspectClass =
    aspect === "square"
      ? "aspect-square"
      : aspect === "portrait"
        ? "aspect-[3/4]"
        : "aspect-video";

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-[13px] font-medium text-black-iron">{label ?? t("Image")}</p>
      <label
        className={cn(
          "group relative block w-full cursor-pointer overflow-hidden rounded-[12px] border border-dashed border-black-iron/20 bg-cream/60 transition-colors hover:border-terracotta/50",
          aspectClass,
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {value ? (
          <>
            <Image
              src={value}
              alt=""
              fill
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black-iron/0 transition-colors group-hover:bg-black-iron/25">
              <span className="rounded-full bg-white px-3 py-1.5 text-[12px] font-medium text-black-iron opacity-0 transition-opacity group-hover:opacity-100">
                {t("Replace photo")}
              </span>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 grid place-items-center text-dark-grey">
            {pending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-5 w-5" strokeWidth={1.5} />
                <span className="text-[13px] font-medium">{t("Upload photo")}</span>
                <span className="text-[11.5px]">{t("JPG, PNG or WebP")}</span>
              </div>
            )}
          </div>
        )}
        {pending && value && (
          <div className="absolute inset-0 grid place-items-center bg-white/70">
            <Loader2 className="h-5 w-5 animate-spin text-black-iron" />
          </div>
        )}
      </label>
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className={chipDangerClass}
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.6} /> {t("Remove photo")}
        </button>
      )}
    </div>
  );
}
