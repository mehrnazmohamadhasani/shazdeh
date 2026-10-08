"use client";
import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/admin/ui";
import { messageFromApiJson, messageFromUnknown } from "@/lib/error-message";
import { uploadAdminImage } from "@/lib/upload-admin-image";

/* Gallery: upload photos, delete photos. New uploads go to the end. */

type Img = { id: string; imageUrl: string };

async function apiError(res: Response, fallback: string): Promise<string> {
  try {
    const msg = messageFromApiJson(await res.json(), fallback);
    if (msg) return msg;
  } catch {
    /* non-JSON body */
  }
  return `${fallback} (${res.status})`;
}

export function GalleryManager({ initial }: { initial: Img[] }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setPending(true);
    let success = 0;
    try {
      for (const file of Array.from(files)) {
        const up = await uploadAdminImage(file, "gallery");
        const res = await fetch("/api/gallery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageUrl: up.url,
            ...(up.width && up.width > 0 ? { width: up.width } : {}),
            ...(up.height && up.height > 0 ? { height: up.height } : {}),
          }),
        });
        if (!res.ok) throw new Error(await apiError(res, "Couldn't save to the gallery"));
        success += 1;
      }
      toast.success(`${success} photo${success === 1 ? "" : "s"} added`);
    } catch (e) {
      toast.error(messageFromUnknown(e, "Upload failed"));
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    }
  }

  async function remove(img: Img) {
    if (!confirm("Delete this photo?")) return;
    setDeleting(img.id);
    const res = await fetch(`/api/gallery/${img.id}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) toast.success("Photo deleted");
    else toast.error("Couldn't delete the photo");
    setDeleting(null);
    router.refresh();
  }

  return (
    <Card
      title={`${initial.length} photo${initial.length === 1 ? "" : "s"}`}
      actions={
        <>
          <input ref={inputRef} type="file" multiple accept="image/*" className="sr-only" onChange={(e) => handleUpload(e.target.files)} />
          <Button size="sm" onClick={() => inputRef.current?.click()} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Add photos
          </Button>
        </>
      }
    >
      {initial.length === 0 ? (
        <EmptyState title="No photos yet" description="Add a few to fill the website gallery." />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {initial.map((img) => (
            <li key={img.id} className="group relative aspect-[4/5] overflow-hidden rounded-[12px] bg-cream">
              <Image src={img.imageUrl} alt="" fill sizes="(min-width: 1024px) 22vw, (min-width: 640px) 30vw, 45vw" className="object-cover" />
              <button
                type="button"
                onClick={() => remove(img)}
                disabled={deleting === img.id}
                aria-label="Delete photo"
                title="Delete photo"
                className="absolute right-2 top-2 grid h-10 w-10 place-items-center rounded-full bg-white/95 text-black-iron shadow-sm transition-colors hover:bg-pomegranate-red hover:text-white"
              >
                {deleting === img.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
