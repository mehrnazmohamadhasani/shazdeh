"use client";
import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Upload, Loader2, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

type Img = {
  id: string;
  title: string | null;
  caption: string | null;
  imageUrl: string;
  order: number;
  isActive: boolean;
};

export function GalleryManager({ initial }: { initial: Img[] }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setPending(true);
    let success = 0;
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fd = new FormData();
        fd.append("file", file);
        fd.append("folder", "gallery");
        const upRes = await fetch("/api/upload", { method: "POST", body: fd });
        if (!upRes.ok) continue;
        const upData = (await upRes.json()) as {
          url: string;
          width: number;
          height: number;
        };
        const createRes = await fetch("/api/gallery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageUrl: upData.url,
            width: upData.width,
            height: upData.height,
            order: initial.length + i,
            title: file.name.replace(/\.[a-z]+$/i, "").replace(/[-_]/g, " "),
          }),
        });
        if (createRes.ok) success += 1;
      }
      toast.success(
        `${success} of ${files.length} image${files.length === 1 ? "" : "s"} uploaded`,
      );
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function patch(img: Img, patch: Partial<Img>) {
    try {
      const res = await fetch(`/api/gallery/${img.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Failed to update");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function remove(img: Img) {
    if (!confirm("Delete this image?")) return;
    try {
      const res = await fetch(`/api/gallery/${img.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Image deleted");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-3">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          className="sr-only"
          onChange={(e) => handleUpload(e.target.files)}
        />
        <Button onClick={() => inputRef.current?.click()} disabled={pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Upload images
        </Button>
      </div>

      {initial.length === 0 ? (
        <div className="py-20 text-center rounded-md border border-warm-white/[0.08] bg-warm-white/[0.02]">
          <p className="font-bold text-2xl tracking-[-0.03em] text-warm-white/70">
            The gallery is empty.
          </p>
          <p className="mt-2 text-warm-white/50 text-[13px] font-light">
            Drop your first images to start the lookbook.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {initial.map((img) => (
            <div
              key={img.id}
              className="group relative overflow-hidden rounded-md border border-warm-white/[0.08] bg-warm-white/[0.02]"
            >
              <div className="relative aspect-[4/5] bg-black-iron">
                <Image
                  src={img.imageUrl}
                  alt={img.title ?? ""}
                  fill
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover"
                />
                {!img.isActive && (
                  <div className="absolute inset-0 bg-black-iron/70 grid place-items-center">
                    <span className="text-warm-white text-[10px] tracking-[0.32em] uppercase font-medium">
                      Hidden
                    </span>
                  </div>
                )}
              </div>
              <div className="p-4 space-y-3">
                <Input
                  value={img.title ?? ""}
                  onChange={(e) =>
                    patch(img, { title: e.target.value || null })
                  }
                  placeholder="Title"
                  className="text-sm h-9"
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={img.isActive}
                      onCheckedChange={(v) => patch(img, { isActive: v })}
                    />
                    <span className="text-warm-white/55">
                      {img.isActive ? (
                        <Eye className="h-3.5 w-3.5" strokeWidth={1.5} />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5" strokeWidth={1.5} />
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={img.order}
                      onChange={(e) =>
                        patch(img, { order: Number(e.target.value) })
                      }
                      className="w-16 h-8 text-xs font-mono"
                      title="Sort order"
                    />
                    <button
                      onClick={() => remove(img)}
                      className="grid place-items-center h-8 w-8 rounded-md text-warm-white/55 hover:text-pomegranate-red hover:bg-pomegranate-red/[0.10]"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

void Plus;
