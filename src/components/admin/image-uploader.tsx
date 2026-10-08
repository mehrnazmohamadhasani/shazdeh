"use client";
import * as React from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Upload, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { messageFromUnknown } from "@/lib/error-message";
import { uploadAdminImage } from "@/lib/upload-admin-image";

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
    setPending(true);
    try {
      const data = await uploadAdminImage(file, folder);
      onChange(data.url);
      toast.success("Image uploaded");
    } catch (e) {
      toast.error(messageFromUnknown(e, "Upload failed"));
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
      <p className="text-[13px] font-medium text-black-iron">{label}</p>
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
                Replace photo
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
                <span className="text-[13px] font-medium">Upload photo</span>
                <span className="text-[11.5px]">JPG, PNG or WebP</span>
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
          className="inline-flex min-h-9 items-center gap-1.5 text-[12.5px] text-dark-grey transition-colors hover:text-pomegranate-red"
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.6} /> Remove photo
        </button>
      )}
    </div>
  );
}
