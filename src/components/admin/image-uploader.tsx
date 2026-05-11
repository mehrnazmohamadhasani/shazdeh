"use client";
import * as React from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Upload, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_UPLOAD_BYTES } from "@/lib/upload-limits";

export function ImageUploader({
  value,
  onChange,
  folder = "general",
  className,
  label = "Image",
  aspect = "video",
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  folder?: string;
  className?: string;
  label?: string;
  aspect?: "video" | "square" | "portrait";
}) {
  const [pending, setPending] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(
        "Image is too large for upload (max 3MB). Resize or export a smaller JPEG, then try again.",
      );
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setPending(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", folder);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const text = await res.text();
      let body: unknown;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        throw new Error(
          res.ok
            ? "Upload failed: invalid response"
            : `Upload failed (${res.status}): ${text.slice(0, 200)}`,
        );
      }
      if (!res.ok) {
        const err = body as { error?: string } | null;
        throw new Error(err?.error ?? `Upload failed (${res.status})`);
      }
      const data = body as { url?: string };
      if (!data?.url) throw new Error("Upload failed: no image URL returned");
      onChange(data.url);
      toast.success("Image uploaded");
    } catch (e) {
      toast.error((e as Error).message);
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
      <p className="text-[10px] font-medium tracking-[0.22em] uppercase text-warm-white/55">
        {label}
      </p>
      <label
        className={cn(
          "group relative block w-full overflow-hidden rounded-md border border-dashed cursor-pointer transition-colors bg-black-iron/40",
          aspectClass,
          value
            ? "border-warm-white/15 hover:border-terracotta/40"
            : "border-warm-white/15 hover:border-terracotta/40 hover:bg-black-iron/60",
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
            <div className="absolute inset-0 bg-black-iron/0 group-hover:bg-black-iron/40 transition-colors flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 text-warm-white text-[10px] tracking-[0.22em] uppercase font-medium transition-opacity">
                Replace
              </span>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 grid place-items-center text-warm-white/55">
            {pending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-5 w-5" strokeWidth={1.5} />
                <span className="text-[12px] font-light">Click to upload</span>
                <span className="text-[10px] text-warm-white/45 font-light">
                  JPG, PNG, WebP · max 3MB (host limit)
                </span>
              </div>
            )}
          </div>
        )}
        {pending && value && (
          <div className="absolute inset-0 bg-black-iron/70 grid place-items-center">
            <Loader2 className="h-5 w-5 text-warm-white animate-spin" />
          </div>
        )}
      </label>
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="inline-flex items-center gap-1.5 text-[11px] font-light text-warm-white/55 hover:text-pomegranate-red transition-colors"
        >
          <X className="h-3 w-3" strokeWidth={1.5} /> Remove image
        </button>
      )}
    </div>
  );
}
