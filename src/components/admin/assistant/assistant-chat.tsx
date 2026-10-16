"use client";
import * as React from "react";
import { toast } from "sonner";
import { AlertCircle, History, Loader2, MessagesSquare, Mic, RotateCw, SendHorizontal, Square, SquarePen, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminPage } from "@/components/admin/ui";
import { UploadButton } from "@/components/admin/ops/upload-button";
import { useAdminI18n } from "@/components/admin/i18n";
import { messageFromUnknown } from "@/lib/error-message";
import { cn } from "@/lib/utils";
import type { ActionCard } from "@/lib/ops/assistant/types";
import { ActionCardView } from "./action-card";
import { ConversationsDialog } from "./conversations-dialog";
import { useVoiceRecorder } from "./use-voice-recorder";

/*
 * The assistant screen, phone first: the conversation fills the screen,
 * the composer sits at the bottom within thumb reach. Speak (tap the mic,
 * tap again to stop) or type; a voice note is written out into the box so
 * a misheard word can be fixed before sending. Suggested changes appear
 * as cards to confirm.
 *
 * Conversations are saved on the server: the header's Conversations
 * button reopens or deletes the latest ones, New conversation starts
 * over. The open conversation's id is remembered for this tab.
 */

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  cards: ActionCard[];
  voice?: boolean;
  /** Not answered: why, shown under the message with a Retry button. */
  failed?: string;
  voiceDocumentId?: string | null;
};

const OPEN = "shazdeh-assistant-conversation";
const newId = () => Math.random().toString(36).slice(2, 10);
const noopSubscribe = () => () => {};

function storedId(): string | null {
  try {
    return sessionStorage.getItem(OPEN);
  } catch {
    return null;
  }
}

function remember(id: string | null) {
  try {
    if (id) sessionStorage.setItem(OPEN, id);
    else sessionStorage.removeItem(OPEN);
  } catch {
    // Private mode: the open conversation just isn't remembered on reload.
  }
}

type Stored = { id: string; role: "user" | "assistant"; text: string; voice: boolean; cards: ActionCard[] };

export function AssistantChat({
  role,
  recent: initialRecent,
  title,
  description,
}: {
  role: string;
  recent: ActionCard[];
  title: string;
  description: string;
}) {
  const { t, dir } = useAdminI18n();
  // The open conversation is known in the browser only; its messages are shown once hydrated and loaded.
  const hydrated = React.useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [conversationId, setConversationId] = React.useState<string | null>(() => (typeof window === "undefined" ? null : storedId()));
  const [loading, setLoading] = React.useState(() => typeof window !== "undefined" && !!storedId());
  const [listOpen, setListOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [chatTitle, setChatTitle] = React.useState<string | null>(null);
  const [text, setText] = React.useState("");
  const [voiceId, setVoiceId] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const [transcribing, setTranscribing] = React.useState(false);
  const [recent, setRecent] = React.useState(initialRecent);
  const recorder = useVoiceRecorder(60);
  const bottom = React.useRef<HTMLDivElement>(null);
  const box = React.useRef<HTMLTextAreaElement>(null);

  /** Shows a saved conversation (or clears the screen when it no longer exists). */
  const show = React.useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/admin/ops/assistant/conversations/${id}`);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw { status: res.status, body };
        const stored = body.conversation.messages as Stored[];
        setMessages(stored.map((m) => ({ id: m.id, role: m.role, text: m.text, cards: m.cards, voice: m.voice })));
        setChatTitle(body.conversation.title);
        setConversationId(id);
        remember(id);
      } catch (e) {
        setMessages([]);
        setConversationId(null);
        setChatTitle(null);
        remember(null);
        if ((e as { status?: number }).status !== 404) toast.error(t(messageFromUnknown((e as { body?: unknown }).body ?? e, "Couldn't open the conversation.")));
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  // Back on this screen in the same tab: reopen the conversation that was open.
  React.useEffect(() => {
    const id = storedId();
    if (id) void show(id);
  }, [show]);

  function startNew() {
    setConversationId(null);
    setChatTitle(null);
    remember(null);
    setMessages([]);
    setText("");
    setVoiceId(null);
    box.current?.focus();
  }
  React.useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  const updateCard = React.useCallback((card: ActionCard) => {
    setMessages((ms) => ms.map((m) => ({ ...m, cards: m.cards.map((c) => (c.id === card.id ? card : c)) })));
    setRecent((rs) => (rs.some((r) => r.id === card.id) ? rs.map((r) => (r.id === card.id ? card : r)) : [card, ...rs]));
  }, []);

  /** Sends what is in the box, or again a message that wasn't answered (`retry`). */
  async function send(content = text, retry?: Message) {
    const words = content.trim();
    if (!words || sending) return;
    const fromVoice = retry ? (retry.voiceDocumentId ?? null) : voiceId;
    const mine: Message = { id: newId(), role: "user", text: words, cards: [], voice: !!fromVoice, voiceDocumentId: fromVoice };
    setMessages((ms) => [...ms.filter((m) => m.id !== retry?.id), mine]);
    if (!retry) {
      setText("");
      setVoiceId(null);
    }
    setSending(true);
    try {
      const res = await fetch("/api/admin/ops/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: words, conversationId, voiceDocumentId: fromVoice }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw { status: res.status, body };
      const cards = (body.cards ?? []) as ActionCard[];
      if (body.conversationId !== conversationId) setChatTitle(words);
      setConversationId(body.conversationId);
      remember(body.conversationId);
      setMessages((ms) => [...ms, { id: newId(), role: "assistant", text: body.reply || (cards.length ? "" : t("Sorry, I have no answer for that.")), cards }]);
      if (cards.length) setRecent((rs) => [...cards, ...rs]);
    } catch (e) {
      // The words stay on screen with the reason and a Retry button, so nothing typed or spoken is lost.
      setMessages((ms) => ms.map((m) => (m.id === mine.id ? { ...m, failed: whyNotAnswered(e) } : m)));
    } finally {
      setSending(false);
    }
  }

  function whyNotAnswered(e: unknown) {
    // fetch itself failed: no network, or the server isn't running.
    if (e instanceof TypeError) return t("Couldn't reach the server. Check the connection, then retry.");
    const { status, body } = e as { status?: number; body?: unknown };
    if (status === 401) return t("You're signed out. Sign in again, then retry.");
    if (status === 403) return t("Your role can't use the assistant.");
    return t(messageFromUnknown(body, "The assistant didn't answer. Try again."));
  }

  async function toggleMic() {
    if (recorder.state === "recording") {
      recorder.stop();
      return;
    }
    let blob: Blob | null;
    try {
      blob = await recorder.start();
    } catch {
      toast.error(t("The microphone isn't available. Allow it in the browser, or type instead."));
      return;
    }
    if (!blob) return;
    setTranscribing(true);
    try {
      const form = new FormData();
      form.append("file", blob, "voice");
      const res = await fetch("/api/admin/ops/assistant/voice", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw body;
      if (!body.text) {
        toast.error(t("Nothing was heard. Try again closer to the phone, or type."));
        return;
      }
      setText((cur) => (cur.trim() ? `${cur.trim()} ${body.text}` : body.text));
      setVoiceId(body.documentId);
      box.current?.focus();
    } catch (e) {
      toast.error(t(messageFromUnknown(e, "Couldn't write down the voice note. Type it instead.")));
    } finally {
      setTranscribing(false);
    }
  }

  const examples =
    role === "PURCHASER"
      ? [t("How much beef is left?"), t("Throw away 2 kg herbs"), t("Count: rice 12 kg, onions 8 kg"), t("Fix yesterday's rice price: 38 not 35")]
      : [t("How much beef is left?"), t("Throw away 2 kg herbs"), t("Change beef in Ghormeh Sabzi to 150 g per portion"), t("Fix yesterday's rice price: 38 not 35"), t("How did we do today?")];
  const recording = recorder.state === "recording";
  // Only once hydrated: the server can't know the tab's open conversation, and a
  // disabled attribute rendered there would otherwise stick after hydration.
  const canStartNew = hydrated && (!!conversationId || messages.length > 0);
  const pendingCards = recent.filter((c) => c.status === "PROPOSED").length;

  return (
    <AdminPage
      title={title}
      description={description}
      className="max-w-3xl pb-0 md:pb-6"
      actions={<UploadButton variant="outline" label={t("Invoice photo")} />}
    >
      <ConversationsDialog
        open={listOpen}
        onOpenChange={setListOpen}
        currentId={conversationId}
        onPick={(id) => {
          if (id === conversationId) return;
          setLoading(true);
          setMessages([]);
          void show(id);
        }}
        onDeleted={(id) => {
          if (id === conversationId) startNew();
        }}
      />
      <div className="flex min-h-[calc(100dvh-9rem)] flex-col md:min-h-[calc(100dvh-12rem)]">
        {/* The open conversation, and moving between conversations: one slim bar above the chat. */}
        <div className="mb-4 flex items-center gap-2 rounded-[14px] border border-black-iron/[0.07] bg-white py-1.5 pe-1.5 ps-4">
          <span dir="auto" className="min-w-0 flex-1 truncate text-[14px] font-medium text-black-iron">
            {hydrated && chatTitle ? chatTitle : t("New conversation")}
          </span>
          <button
            type="button"
            onClick={() => setListOpen(true)}
            aria-label={t("Conversations")}
            title={t("Conversations")}
            className="inline-flex h-10 min-w-10 shrink-0 items-center justify-center gap-1.5 rounded-full px-2.5 text-[13px] text-black-iron transition-colors hover:bg-black-iron/[0.05]"
          >
            <MessagesSquare className="h-[18px] w-[18px]" />
            <span className="sr-only sm:not-sr-only">{t("Conversations")}</span>
          </button>
          <button
            type="button"
            onClick={startNew}
            disabled={sending || !canStartNew}
            aria-label={t("New conversation")}
            title={t("New conversation")}
            className="inline-flex h-10 min-w-10 shrink-0 items-center justify-center gap-1.5 rounded-full px-2.5 text-[13px] text-black-iron transition-colors hover:bg-black-iron/[0.05] disabled:opacity-40"
          >
            <SquarePen className="h-[18px] w-[18px]" />
            <span className="sr-only sm:not-sr-only">{t("New conversation")}</span>
          </button>
        </div>

        {recent.length > 0 && (
          <details className="group mb-4 rounded-[14px] border border-black-iron/[0.07] bg-white">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-[14px] font-medium text-black-iron">
              <History className="h-4 w-4 text-dark-grey" />
              {t("Recent changes")}
              {pendingCards > 0 && <span className="rounded-full bg-terracotta/[0.12] px-2 py-0.5 text-[11.5px] text-terracotta-ink">{t("{n} waiting", { n: pendingCards })}</span>}
            </summary>
            <div className="space-y-3 border-t border-black-iron/[0.06] p-3">
              {recent.map((c) => (
                <ActionCardView key={c.id} card={c} onChange={updateCard} />
              ))}
            </div>
          </details>
        )}

        <div className="flex-1 space-y-4 pb-4" aria-live="polite">
          {hydrated && loading && (
            <div className="flex items-center gap-2 py-6 text-[13px] text-dark-grey">
              <Loader2 className="h-4 w-4 animate-spin" /> {t("Loading…")}
            </div>
          )}
          {hydrated && !loading && messages.length === 0 && (
            <div className="rounded-[16px] border border-dashed border-black-iron/[0.12] p-5">
              <p className="text-[15px] font-medium text-black-iron">{t("Ask or tell me in Persian, English or Arabic.")}</p>
              <p className="mt-1 text-[13px] text-dark-grey">{t("Every change shows before and after, and waits for you to confirm it.")}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {examples.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => {
                      setText(ex);
                      box.current?.focus();
                    }}
                    className="rounded-full border border-black-iron/[0.12] bg-white px-3.5 py-2 text-start text-[13px] text-black-iron transition-colors hover:border-terracotta"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}
          {hydrated &&
            messages.map((m) => (
              <div key={m.id} className={cn("flex flex-col gap-2", m.role === "user" ? "items-end" : "items-start")}>
                {m.text && (
                  <div
                    dir="auto"
                    className={cn(
                      "max-w-[88%] whitespace-pre-wrap rounded-[18px] px-4 py-2.5 text-[15px] leading-relaxed",
                      m.role === "user" ? "rounded-ee-[6px] bg-black-iron text-warm-white" : "rounded-es-[6px] bg-white text-black-iron shadow-[0_1px_2px_rgba(0,0,0,0.05)]",
                      m.failed && "opacity-60",
                    )}
                  >
                    {m.voice && <Mic className="me-1.5 inline h-3.5 w-3.5 opacity-70" aria-label={t("From a voice note")} />}
                    {m.text}
                  </div>
                )}
                {m.failed && (
                  <div className="flex max-w-[88%] flex-wrap items-center justify-end gap-x-3 gap-y-1 text-[12.5px]">
                    <span className="inline-flex items-center gap-1 text-pomegranate-red">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {t("Not sent")}: {m.failed}
                    </span>
                    <button
                      type="button"
                      disabled={sending}
                      onClick={() => void send(m.text, m)}
                      className="inline-flex items-center gap-1 font-medium text-terracotta-ink hover:underline disabled:opacity-50"
                    >
                      <RotateCw className="h-3.5 w-3.5" /> {t("Retry")}
                    </button>
                  </div>
                )}
                {m.cards.map((c) => (
                  <div key={c.id} className="w-full max-w-md">
                    <ActionCardView card={c} onChange={updateCard} />
                  </div>
                ))}
              </div>
            ))}
          {sending && (
            <div className="flex items-center gap-2 text-[13px] text-dark-grey">
              <Loader2 className="h-4 w-4 animate-spin" /> {t("Thinking…")}
            </div>
          )}
          <div ref={bottom} />
        </div>

        <div className="sticky bottom-0 -mx-4 border-t border-black-iron/[0.07] bg-warm-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:mx-0 sm:rounded-[16px] sm:border">
          {voiceId && !recording && (
            <div className="mb-2 flex items-center justify-between gap-2 text-[12.5px] text-dark-grey">
              <span className="inline-flex items-center gap-1.5">
                <Mic className="h-3.5 w-3.5" /> {t("From your voice note — check the words, then send.")}
              </span>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-dark-grey hover:text-black-iron"
                onClick={() => {
                  setVoiceId(null);
                  setText("");
                }}
              >
                <Trash2 className="h-3.5 w-3.5" /> {t("Clear")}
              </button>
            </div>
          )}
          {recording ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={recorder.cancel}
                aria-label={t("Cancel recording")}
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-dark-grey hover:bg-black-iron/[0.05]"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="flex flex-1 items-center gap-2 text-[15px] font-medium text-pomegranate-red">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-pomegranate-red" />
                {t("Listening…")} {`0:${String(recorder.seconds).padStart(2, "0")}`}
                <span className="text-[12px] font-normal text-dark-grey">{t("tap to stop")}</span>
              </div>
              <button
                type="button"
                onClick={toggleMic}
                aria-label={t("Stop and write it down")}
                className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-pomegranate-red text-white shadow-lg"
              >
                <Square className="h-5 w-5 fill-current" />
              </button>
            </div>
          ) : (
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <textarea
                ref={box}
                dir="auto"
                rows={1}
                value={text}
                disabled={transcribing}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder={transcribing ? t("Writing down your voice note…") : t("Type, or tap the mic and speak")}
                className="max-h-40 min-h-12 flex-1 resize-none rounded-[22px] border border-black-iron/[0.12] bg-white px-4 py-3 text-[15px] leading-snug text-black-iron outline-none placeholder:text-dark-grey/70 focus:border-terracotta [field-sizing:content]"
              />
              {text.trim() ? (
                <Button type="submit" size="icon" className="h-12 w-12" disabled={sending} aria-label={t("Send")}>
                  {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <SendHorizontal className={cn("h-5 w-5", dir === "rtl" && "rotate-180")} />}
                </Button>
              ) : null}
              {recorder.supported && (
                <button
                  type="button"
                  onClick={toggleMic}
                  disabled={transcribing || sending || recorder.state === "starting"}
                  aria-label={t("Speak")}
                  className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-terracotta text-white shadow-lg transition-transform active:scale-95 disabled:opacity-50"
                >
                  {transcribing || recorder.state === "starting" ? <Loader2 className="h-6 w-6 animate-spin" /> : <Mic className="h-6 w-6" />}
                </button>
              )}
            </form>
          )}
        </div>
      </div>
    </AdminPage>
  );
}
