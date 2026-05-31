"use client";

import { useEffect, useState } from "react";

const SEEN_KEY = "push-optin-seen";
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function subscribe(): Promise<boolean> {
  if (!VAPID_PUBLIC_KEY) return false;
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub.toJSON()),
  });
  return res.ok;
}

export function PushOptin() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window &&
      !!VAPID_PUBLIC_KEY;
    if (!supported) return;

    // Already granted: keep the server's subscription in sync silently.
    if (Notification.permission === "granted") {
      subscribe().catch(() => {});
      return;
    }
    // Denied, or we've already shown the prompt once: stay quiet.
    if (Notification.permission === "denied") return;
    if (localStorage.getItem(SEEN_KEY)) return;

    setShowBanner(true);
  }, []);

  function dismiss() {
    localStorage.setItem(SEEN_KEY, "1");
    setShowBanner(false);
  }

  async function enable() {
    localStorage.setItem(SEEN_KEY, "1");
    setShowBanner(false);
    try {
      const perm = await Notification.requestPermission();
      if (perm === "granted") await subscribe();
    } catch {
      // ignore — user can retry later via the prompt
    }
  }

  if (!showBanner) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-slate-50 shadow-lg">
        <div className="flex-1 text-sm leading-snug">
          알림을 켜면 멤버가 인증할 때 바로 알 수 있어요.
        </div>
        <button
          onClick={enable}
          className="shrink-0 rounded-full bg-amber-400 px-4 py-1.5 text-sm font-semibold text-slate-900"
        >
          켜기
        </button>
        <button
          onClick={dismiss}
          aria-label="나중에"
          className="shrink-0 rounded-full px-2 py-1 text-slate-400"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
