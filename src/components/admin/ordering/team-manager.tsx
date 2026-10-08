"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Role = "ADMIN" | "EDITOR" | "STAFF";
export type TeamRow = { id: string; email: string; name: string | null; role: Role };

const ROLE_HINT: Record<Role, string> = {
  ADMIN: "Everything, including settings, payments and team",
  EDITOR: "Menu, content, zones and promo codes",
  STAFF: "Orders board only — for kitchen tablets",
};

export function TeamManager({ users, selfId }: { users: TeamRow[]; selfId: string }) {
  const router = useRouter();
  const [form, setForm] = React.useState({ email: "", name: "", role: "STAFF" as Role, password: "" });
  const [busy, setBusy] = React.useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/admin/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, name: form.name || null }),
    });
    setBusy(false);
    if (!res.ok) return toast.error((await res.json().catch(() => null))?.error ?? "Couldn't add");
    toast.success("Team member added — share the password with them privately");
    setForm({ email: "", name: "", role: "STAFF", password: "" });
    router.refresh();
  }

  async function patch(id: string, body: object, msg: string) {
    const res = await fetch(`/api/admin/team/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) return toast.error((await res.json().catch(() => null))?.error ?? "Couldn't update");
    toast.success(msg);
    router.refresh();
  }

  async function remove(u: TeamRow) {
    if (!confirm(`Remove ${u.email}? They lose access immediately.`)) return;
    const res = await fetch(`/api/admin/team/${u.id}`, { method: "DELETE" });
    if (!res.ok) return toast.error((await res.json().catch(() => null))?.error ?? "Couldn't remove");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div className="divide-y divide-warm-white/[0.06] rounded-md border border-warm-white/[0.08]">
        {users.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium text-warm-white">{u.name ?? u.email}</p>
              <p className="truncate text-[12px] text-warm-white/55">{u.email}</p>
            </div>
            <select
              value={u.role}
              onChange={(e) => patch(u.id, { role: e.target.value }, "Role updated")}
              className="h-10 rounded-md border border-warm-white/10 bg-black-iron/60 px-3 text-[13px] text-warm-white"
            >
              {(["ADMIN", "EDITOR", "STAFF"] as const).map((r) => (
                <option key={r} value={r}>
                  {r.charAt(0) + r.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const pw = prompt("New password (10+ characters):");
                if (pw) patch(u.id, { password: pw }, "Password changed");
              }}
            >
              Reset password
            </Button>
            {u.id !== selfId && (
              <Button size="icon" variant="ghost" aria-label={`Remove ${u.email}`} onClick={() => remove(u)}>
                <Trash2 className="h-4 w-4 text-pomegranate-red" />
              </Button>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={add} className="space-y-4 rounded-md border border-warm-white/[0.08] bg-warm-white/[0.02] p-6">
        <h2 className="text-xl font-bold tracking-[-0.03em] text-warm-white">Add a team member</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2"><Label>Email</Label><Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="space-y-2">
            <Label>Role</Label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} className="flex h-12 w-full rounded-md border border-warm-white/10 bg-black-iron/60 px-3 text-[13px] text-warm-white">
              <option value="STAFF">Staff</option>
              <option value="EDITOR">Editor</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <div className="space-y-2"><Label>Temporary password</Label><Input type="text" required minLength={10} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
        </div>
        <p className="text-[12px] text-warm-white/55">{ROLE_HINT[form.role]}</p>
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add member
        </Button>
      </form>
    </div>
  );
}
