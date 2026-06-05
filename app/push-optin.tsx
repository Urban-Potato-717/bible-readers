"use client";

import { useEffect, useState } from "react";
import { pushSupported, subscribePush } from "@/lib/push-client";

const SEEN_KEY = "push-optin-seen";

export function PushOptin() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (!pushSupported()) return;

    // Already granted: keep the server's subscription in sync silently.
    if (Notification.permission === "granted") {
      subscribePush().catch(() => {});
      return;
    }
    // Denied, or we've already shown the prompt once: stay quiet.
    if (Notification.permission === "denied") return;
    if (localStorage.getItem(SEEN_KEY)) return;

    const id = requestAnimationFrame(() => setShowBanner(true));
    return () => cancelAnimationFrame(id);
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
      if (perm === "granted") await subscribePush();
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
