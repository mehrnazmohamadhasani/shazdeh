"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, Field, IconButton, Select, TextInput } from "@/components/admin/ui";
import { useAdminI18n } from "@/components/admin/i18n";

type Role = "ADMIN" | "EDITOR" | "STAFF";
export type TeamRow = { id: string; email: string; name: string | null; role: Role };

const ROLES: { value: Role; label: string; hint: string }[] = [
  { value: "STAFF", label: "Kitchen staff", hint: "Orders board only — for kitchen tablets." },
  { value: "EDITOR", label: "Editor", hint: "Menu, zones, promo codes and website content." },
  { value: "ADMIN", label: "Admin", hint: "Everything, including settings and the team." },
];

export function TeamManager({ users, selfId }: { users: TeamRow[]; selfId: string }) {
  const { t } = useAdminI18n();
  const router = useRouter();
  const [form, setForm] = React.useState({ email: "", name: "", role: "STAFF" as Role, password: "" });
  const [busy, setBusy] = React.useState(false);
  const roleHint = ROLES.find((r) => r.value === form.role)?.hint;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/admin/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, name: form.name || null }),
    });
    setBusy(false);
    if (!res.ok) return toast.error(t((await res.json().catch(() => null))?.error ?? "Couldn't add"));
    toast.success(t("Added — share the password with them privately"));
    setForm({ email: "", name: "", role: "STAFF", password: "" });
    router.refresh();
  }

  async function patch(id: string, body: object, msg: string) {
    const res = await fetch(`/api/admin/team/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) return toast.error(t((await res.json().catch(() => null))?.error ?? "Couldn't update"));
    toast.success(t(msg));
    router.refresh();
  }

  async function remove(u: TeamRow) {
    if (!confirm(t("Remove {email}? They lose access immediately.", { email: u.email }))) return;
    const res = await fetch(`/api/admin/team/${u.id}`, { method: "DELETE" });
    if (!res.ok) return toast.error(t((await res.json().catch(() => null))?.error ?? "Couldn't remove"));
    router.refresh();
  }

  return (
    <>
      <Card bodyClassName="p-0 md:p-0">
        <ul className="divide-y divide-black-iron/[0.06]">
          {users.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3 md:px-6">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-terracotta/[0.1] text-[13px] font-semibold text-terracotta-ink">
                {(u.name ?? u.email).charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium">
                  <span dir="auto">{u.name ?? u.email}</span>
                  {u.id === selfId && <span className="ms-2 text-[12px] font-normal text-dark-grey">{t("(you)")}</span>}
                </span>
                <span dir="auto" className="block truncate text-[12.5px] text-dark-grey">{u.email}</span>
              </span>
              <Select value={u.role} onChange={(e) => patch(u.id, { role: e.target.value }, "Role updated")} aria-label={t("Role for {email}", { email: u.email })} className="h-10 w-40">
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {t(r.label)}
                  </option>
                ))}
              </Select>
              <IconButton
                label={t("New password for {email}", { email: u.email })}
                onClick={() => {
                  const pw = prompt(t("New password (10 or more characters):"));
                  if (pw) patch(u.id, { password: pw }, "Password changed");
                }}
              >
                <KeyRound className="h-4 w-4" />
              </IconButton>
              {u.id !== selfId && (
                <IconButton label={t("Remove {email}", { email: u.email })} onClick={() => remove(u)} danger>
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card title={t("Add someone")}>
        <form onSubmit={add} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t("Email")} required>
              <TextInput dir="ltr" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label={t("Name")}>
              <TextInput dir="auto" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label={t("Role")} hint={roleHint && t(roleHint)}>
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {t(r.label)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("Temporary password")} hint={t("At least 10 characters.")} required>
              <TextInput dir="ltr" type="text" required minLength={10} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>
          </div>
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {t("Add")}
          </Button>
        </form>
      </Card>
    </>
  );
}
