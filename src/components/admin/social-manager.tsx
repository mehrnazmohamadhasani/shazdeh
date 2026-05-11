"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { getSocialIcon } from "@/components/icons/social";

type Link = {
  id: string;
  platform: string;
  label: string;
  url: string;
  order: number;
  isActive: boolean;
};

const PLATFORMS = [
  "instagram",
  "tiktok",
  "whatsapp",
  "talabat",
  "deliveroo",
  "careem",
  "noon",
  "other",
];

export function SocialManager({ initial }: { initial: Link[] }) {
  const router = useRouter();
  const [links, setLinks] = React.useState(initial);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => setLinks(initial), [initial]);

  function update(id: string, patch: Partial<Link>) {
    setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  async function persist(link: Link) {
    try {
      await fetch(`/api/social/${link.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: link.platform,
          label: link.label,
          url: link.url,
          order: link.order,
          isActive: link.isActive,
        }),
      });
    } catch {
      toast.error("Failed to save");
    }
  }

  async function add() {
    setPending(true);
    try {
      const res = await fetch("/api/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: "instagram",
          label: "Instagram",
          url: "https://instagram.com/",
          order: links.length,
          isActive: true,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this link?")) return;
    try {
      await fetch(`/api/social/${id}`, { method: "DELETE" });
      router.refresh();
    } catch {
      toast.error("Failed to delete");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={add} disabled={pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          New link
        </Button>
      </div>

      <div className="rounded-md border border-warm-white/[0.08] bg-warm-white/[0.02] overflow-hidden">
        <div className="hidden md:grid grid-cols-[40px_180px_minmax(0,1fr)_minmax(0,2fr)_80px_60px_60px] items-center gap-3 px-4 py-3 border-b border-warm-white/[0.08] text-[10px] tracking-[0.22em] uppercase font-medium text-warm-white/55">
          <span></span>
          <span>Platform</span>
          <span>Label</span>
          <span>URL</span>
          <span>Order</span>
          <span>Live</span>
          <span></span>
        </div>
        {links.map((link) => {
          const Icon = getSocialIcon(link.platform);
          return (
            <div
              key={link.id}
              className="grid grid-cols-2 md:grid-cols-[40px_180px_minmax(0,1fr)_minmax(0,2fr)_80px_60px_60px] items-center gap-3 px-4 py-3 border-b border-warm-white/[0.06] last:border-0"
            >
              <div className="grid place-items-center h-9 w-9 rounded-full bg-warm-white/[0.05] text-warm-white/70 col-span-2 md:col-span-1">
                {Icon ? <Icon className="h-4 w-4" /> : null}
              </div>
              <select
                value={link.platform}
                onChange={(e) => {
                  update(link.id, { platform: e.target.value });
                  persist({ ...link, platform: e.target.value });
                }}
                className="h-10 rounded-md border border-warm-white/10 bg-black-iron/60 px-2 text-[13px] font-light text-warm-white focus:outline-none focus:ring-1 focus:ring-terracotta/40"
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <Input
                value={link.label}
                onChange={(e) => update(link.id, { label: e.target.value })}
                onBlur={() => persist(link)}
                placeholder="Label"
                className="h-10"
              />
              <Input
                value={link.url}
                onChange={(e) => update(link.id, { url: e.target.value })}
                onBlur={() => persist(link)}
                placeholder="https://..."
                className="h-10 font-mono text-xs"
              />
              <Input
                type="number"
                value={link.order}
                onChange={(e) =>
                  update(link.id, { order: Number(e.target.value) })
                }
                onBlur={() => persist(link)}
                className="h-10 w-20 font-mono"
              />
              <div className="flex items-center justify-center">
                <Switch
                  checked={link.isActive}
                  onCheckedChange={(v) => {
                    update(link.id, { isActive: v });
                    persist({ ...link, isActive: v });
                  }}
                />
              </div>
              <button
                onClick={() => remove(link.id)}
                className="grid place-items-center h-9 w-9 rounded-md text-warm-white/55 hover:text-pomegranate-red hover:bg-pomegranate-red/[0.10]"
                aria-label="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            </div>
          );
        })}
        {links.length === 0 && (
          <div className="py-16 text-center">
            <p className="font-bold text-2xl tracking-[-0.03em] text-warm-white/70">
              No links yet.
            </p>
            <p className="mt-2 text-warm-white/50 text-[13px] font-light">
              Add Instagram, WhatsApp and your delivery partners.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
