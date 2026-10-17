"use client";
import * as React from "react";
import { toast } from "sonner";
import { Check, Loader2, MessagesSquare, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAdminI18n } from "@/components/admin/i18n";
import { messageFromUnknown } from "@/lib/error-message";
import { cn } from "@/lib/utils";

/*
 * This person's latest conversations: tap one to open it, or delete it
 * (asked once more in place, so a stray tap never deletes). Deleting only
 * removes the words; the changes a conversation made stay.
 */

type Summary = { id: string; title: string; updatedAt: string; messages: number };

export function ConversationsDialog({
  open,
  onOpenChange,
  currentId,
  onPick,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentId: string | null;
  onPick: (id: string) => void;
  onDeleted: (id: string) => void;
}) {
  const { t, date } = useAdminI18n();
  const [list, setList] = React.useState<Summary[] | null>(null);
  const [asking, setAsking] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let live = true;
    fetch("/api/admin/ops/assistant/conversations")
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw body;
        if (live) setList(body.conversations);
      })
      .catch((e) => {
        if (!live) return;
        setList([]);
        toast.error(t(messageFromUnknown(e, "Couldn't load your conversations.")));
      });
    return () => {
      live = false;
    };
  }, [open, t]);

  async function remove(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/ops/assistant/conversations/${id}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw body;
      setList((l) => l?.filter((c) => c.id !== id) ?? null);
      onDeleted(id);
      toast.success(t("Conversation deleted."));
    } catch (e) {
      toast.error(t(messageFromUnknown(e, "Couldn't delete it. Try again.")));
    } finally {
      setDeleting(null);
      setAsking(null);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setAsking(null);
          setList(null);
        }
      }}
    >
      <DialogContent className="bg-white sm:max-w-md">
        <DialogTitle className="px-5 pt-6 text-[20px] font-bold tracking-[-0.02em]">{t("Recent conversations")}</DialogTitle>
        <DialogDescription className="px-5 pt-1 text-[14px] text-dark-grey">
          {t("Your last 5. Deleting a conversation keeps the changes it made.")}
        </DialogDescription>
        <div className="px-4 pb-[max(1.25rem,var(--safe-bottom))] pt-4">
          {list === null ? (
            <div className="flex items-center justify-center gap-2 py-8 text-[14px] text-dark-grey">
              <Loader2 className="h-4 w-4 animate-spin" /> {t("Loading…")}
            </div>
          ) : list.length === 0 ? (
            <p className="py-8 text-center text-[14px] text-dark-grey">{t("No saved conversations yet.")}</p>
          ) : (
            <ul className="space-y-2">
              {list.map((c) => (
                <li
                  key={c.id}
                  className={cn("rounded-[14px] border border-black-iron/[0.08]", c.id === currentId && "border-terracotta/50 bg-terracotta/[0.04]")}
                >
                  {asking === c.id ? (
                    <div className="flex flex-wrap items-center gap-2 p-3">
                      <span className="flex-1 text-[14px] font-medium text-pomegranate-red">{t("Delete this conversation?")}</span>
                      <button
                        type="button"
                        disabled={deleting === c.id}
                        onClick={() => void remove(c.id)}
                        className="inline-flex h-10 items-center gap-1.5 rounded-full bg-pomegranate-red px-4 text-[13px] font-medium text-white disabled:opacity-60"
                      >
                        {deleting === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        {t("Delete")}
                      </button>
                      <button
                        type="button"
                        disabled={deleting === c.id}
                        onClick={() => setAsking(null)}
                        className="h-10 rounded-full px-4 text-[13px] text-dark-grey hover:bg-black-iron/[0.05]"
                      >
                        {t("Cancel")}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          onPick(c.id);
                          onOpenChange(false);
                        }}
                        className="flex min-w-0 flex-1 items-start gap-3 p-3 text-start"
                      >
                        <MessagesSquare className="mt-0.5 h-5 w-5 shrink-0 text-terracotta-ink" strokeWidth={1.7} />
                        <span className="min-w-0">
                          <span dir="auto" className="block truncate text-[15px] font-medium text-black-iron">
                            {c.title}
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-dark-grey">
                            <span className="whitespace-nowrap">{date(c.updatedAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                            <span className="whitespace-nowrap">{t("{n} messages", { n: c.messages })}</span>
                            {c.id === currentId && (
                              <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-terracotta/[0.1] px-2 py-0.5 text-[11.5px] font-medium text-terracotta-ink">
                                <Check className="h-3 w-3" /> {t("Open now")}
                              </span>
                            )}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAsking(c.id)}
                        aria-label={t("Delete conversation")}
                        title={t("Delete conversation")}
                        className="me-1.5 grid h-10 w-10 shrink-0 place-items-center rounded-full text-dark-grey transition-colors hover:bg-pomegranate-red/[0.08] hover:text-pomegranate-red"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
