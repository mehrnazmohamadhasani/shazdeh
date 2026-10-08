"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, EmptyState, Select, TextInput, IconButton } from "@/components/admin/ui";
import { getSocialIcon } from "@/components/icons/social";
import { messageFromApiJson } from "@/lib/error-message";

type Link = { id: string; platform: string; label: string; url: string; order: number; isActive: boolean };

const PLATFORMS: [string, string][] = [
  ["instagram", "Instagram"],
  ["tiktok", "TikTok"],
  ["whatsapp", "WhatsApp"],
  ["talabat", "Talabat"],
  ["deliveroo", "Deliveroo"],
  ["careem", "Careem"],
  ["noon", "Noon"],
  ["keeta", "Keeta"],
  ["other", "Other"],
];

export function SocialManager({ initial }: { initial: Link[] }) {
  const router = useRouter();
  const [links, setLinks] = React.useState(initial);
  const [pending, setPending] = React.useState(false);

  // Re-sync local edits when the server sends a fresh list (after router.refresh()).
  const [synced, setSynced] = React.useState(initial);
  if (synced !== initial) {
    setSynced(initial);
    setLinks(initial);
  }

  function update(id: string, patch: Partial<Link>) {
    setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  async function persist(link: Link, patch: Partial<Link> = {}) {
    const next = { ...link, ...patch };
    const before = initial.find((l) => l.id === link.id);
    if (before && (["platform", "label", "url", "order", "isActive"] as const).every((k) => before[k] === next[k])) return;
    try {
      const res = await fetch(`/api/social/${link.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: next.platform, label: next.label, url: next.url, order: next.order, isActive: next.isActive }),
      });
      if (!res.ok) {
        toast.error(messageFromApiJson(await res.json().catch(() => null), "Couldn't save") ?? "Couldn't save");
      }
    } catch {
      toast.error("Couldn't save");
    }
    router.refresh();
  }

  async function add() {
    setPending(true);
    try {
      const res = await fetch("/api/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "instagram", label: "Instagram", url: "https://instagram.com/", order: links.length + 1, isActive: false }),
      });
      if (!res.ok) throw new Error("Couldn't add the link");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this link?")) return;
    await fetch(`/api/social/${id}`, { method: "DELETE" }).catch(() => toast.error("Couldn't delete"));
    router.refresh();
  }

  async function move(index: number, dir: -1 | 1) {
    const list = [...links];
    const to = index + dir;
    if (to < 0 || to >= list.length) return;
    [list[index], list[to]] = [list[to], list[index]];
    await Promise.all(list.map((l, i) => (l.order === i + 1 ? null : persist(l, { order: i + 1 }))));
  }

  return (
    <Card
      bodyClassName="p-0 md:p-0"
      title="Links"
      description="New links start hidden — switch them on once the address is right."
      actions={
        <Button size="sm" onClick={add} disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add link
        </Button>
      }
    >
      {links.length === 0 ? (
        <EmptyState title="No links yet" description="Add Instagram, WhatsApp and your delivery apps." />
      ) : (
        <ul className="divide-y divide-black-iron/[0.06]">
          {links.map((link, i) => {
            const Icon = getSocialIcon(link.platform);
            return (
              <li key={link.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 md:grid-cols-[auto_150px_minmax(0,1fr)_minmax(0,1.6fr)_auto_auto] md:px-6">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-black-iron/[0.04] text-dark-grey">
                  {Icon && <Icon className="h-4 w-4" />}
                </span>
                <Select
                  value={link.platform}
                  aria-label="Platform"
                  onChange={(e) => {
                    update(link.id, { platform: e.target.value });
                    persist(link, { platform: e.target.value });
                  }}
                  className="h-10"
                >
                  {PLATFORMS.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
                <span className="flex items-center md:order-5">
                  <Switch
                    checked={link.isActive}
                    aria-label="Show on website"
                    onCheckedChange={(v) => {
                      update(link.id, { isActive: v });
                      persist(link, { isActive: v });
                    }}
                  />
                </span>
                <TextInput
                  value={link.label}
                  aria-label="Label"
                  onChange={(e) => update(link.id, { label: e.target.value })}
                  onBlur={() => persist(link)}
                  placeholder="Label"
                  className="col-span-3 h-10 md:order-3 md:col-span-1"
                />
                <TextInput
                  value={link.url}
                  aria-label="Address"
                  onChange={(e) => update(link.id, { url: e.target.value })}
                  onBlur={() => persist(link)}
                  placeholder="https://…"
                  className="col-span-3 h-10 md:order-4 md:col-span-1"
                />
                <span className="col-span-3 flex items-center justify-end md:order-6 md:col-span-1">
                  <IconButton label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp className="h-4 w-4" />
                  </IconButton>
                  <IconButton label="Move down" disabled={i === links.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown className="h-4 w-4" />
                  </IconButton>
                  <IconButton label="Delete link" onClick={() => remove(link.id)} danger>
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
