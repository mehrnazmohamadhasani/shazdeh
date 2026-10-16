"use client";
import * as React from "react";

/*
 * Records one voice note in the browser: tap to start, tap to stop
 * (easier with wet or gloved hands than holding). The browser's own noise
 * suppression and echo cancellation take the edge off kitchen noise;
 * recording stops by itself after a minute. Chrome/Android record WebM
 * (Opus), iPhone Safari MP4 (AAC) — the server takes both.
 */

const TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

const noopSubscribe = () => () => {};

export type RecorderState = "idle" | "starting" | "recording";

export function useVoiceRecorder(maxSeconds = 60) {
  const [state, setState] = React.useState<RecorderState>("idle");
  const [seconds, setSeconds] = React.useState(0);
  const recorder = React.useRef<MediaRecorder | null>(null);
  const chunks = React.useRef<Blob[]>([]);
  const timer = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const done = React.useRef<((blob: Blob | null) => void) | null>(null);
  // Known only in the browser; the server renders without the mic.
  const supported = React.useSyncExternalStore(
    noopSubscribe,
    () => "MediaRecorder" in window && !!navigator.mediaDevices?.getUserMedia,
    () => false,
  );

  const cleanup = React.useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    recorder.current?.stream.getTracks().forEach((t) => t.stop());
    recorder.current = null;
    setState("idle");
    setSeconds(0);
  }, []);

  React.useEffect(() => cleanup, [cleanup]);

  /** Resolves with the recording when stop() is called (or the minute is up); null if cancelled. */
  const start = React.useCallback(async (): Promise<Blob | null> => {
    if (recorder.current) return null;
    setState("starting");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { noiseSuppression: true, echoCancellation: true, autoGainControl: true, channelCount: 1 },
      });
    } catch (e) {
      setState("idle");
      throw e;
    }
    const mimeType = TYPES.find((t) => MediaRecorder.isTypeSupported(t));
    const rec = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 32_000 });
    recorder.current = rec;
    chunks.current = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.current.push(e.data);
    };
    const result = new Promise<Blob | null>((resolve) => {
      done.current = resolve;
    });
    rec.onstop = () => {
      const keep = done.current;
      done.current = null;
      const blob = chunks.current.length ? new Blob(chunks.current, { type: rec.mimeType || mimeType || "audio/webm" }) : null;
      cleanup();
      keep?.(blob);
    };
    rec.start(1000);
    setState("recording");
    const began = Date.now();
    timer.current = setInterval(() => {
      const s = Math.floor((Date.now() - began) / 1000);
      setSeconds(s);
      if (s >= maxSeconds && rec.state === "recording") rec.stop();
    }, 250);
    return result;
  }, [cleanup, maxSeconds]);

  const stop = React.useCallback(() => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);

  const cancel = React.useCallback(() => {
    const keep = done.current;
    done.current = null;
    chunks.current = [];
    if (recorder.current?.state === "recording") recorder.current.stop();
    else cleanup();
    keep?.(null);
  }, [cleanup]);

  return { supported, state, seconds, maxSeconds, start, stop, cancel };
}
