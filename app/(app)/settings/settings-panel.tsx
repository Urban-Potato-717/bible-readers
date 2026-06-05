"use client";

import { useEffect, useState } from "react";
import {
  pushSupported,
  subscribePush,
  unsubscribePush,
  hasPushSubscription,
} from "@/lib/push-client";

type NotifState = "loading" | "unsupported" | "denied" | "on" | "off";

function Switch({ on, label }: { on: boolean; label: string }) {
  return (
    <span className="flex items-center gap-2 shrink-0">
      <span
        className={`text-xs font-medium ${
          on ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"
        }`}
      >
        {label}
      </span>
      <span
        aria-hidden
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          on ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-700"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            on ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </span>
    </span>
  );
}

export function SettingsPanel() {
  const [dark, setDark] = useState(false);
  const [notif, setNotif] = useState<NotifState>("loading");
  const [busy, setBusy] = useState(false);

  // Sync the dark toggle to the actual theme after mount, so the server-rendered
  // markup (always `false`) matches the first client render and stays interactive.
  useEffect(() => {
    const id = requestAnimationFrame(() =>
      setDark(document.documentElement.classList.contains("dark"))
    );
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!pushSupported()) {
        setNotif("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setNotif("denied");
        return;
      }
      const has = await hasPushSubscription();
      if (!cancelled) setNotif(has ? "on" : "off");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleDark() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    setDark(next);
  }

  async function toggleNotif() {
    if (busy || notif === "loading" || notif === "unsupported" || notif === "denied")
      return;
    setBusy(true);
    try {
      if (notif === "on") {
        await unsubscribePush();
        setNotif("off");
      } else {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          setNotif(perm === "denied" ? "denied" : "off");
          return;
        }
        const ok = await subscribePush();
        setNotif(ok ? "on" : "off");
      }
    } catch {
      // leave the current state; the user can retry
    } finally {
      setBusy(false);
    }
  }

  const notifLocked =
    busy || notif === "loading" || notif === "unsupported" || notif === "denied";

  return (
    <div className="space-y-3">
      {/* dark mode */}
      <button
        type="button"
        onClick={toggleDark}
        className="w-full text-left rounded-2xl bg-white border border-slate-200 p-4 flex items-center justify-between active:opacity-80 dark:bg-slate-900 dark:border-slate-800"
      >
        <span>
          <span className="block font-medium">다크 모드</span>
          <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            어두운 테마로 표시합니다.
          </span>
        </span>
        <Switch on={dark} label={dark ? "켜짐" : "꺼짐"} />
      </button>

      {/* notifications */}
      <button
        type="button"
        onClick={toggleNotif}
        disabled={notifLocked}
        className="w-full text-left rounded-2xl bg-white border border-slate-200 p-4 flex items-center justify-between active:opacity-80 disabled:active:opacity-100 dark:bg-slate-900 dark:border-slate-800"
      >
        <span>
          <span className="block font-medium">알림</span>
          <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {notif === "unsupported"
              ? "이 기기에서는 알림을 지원하지 않아요."
              : notif === "denied"
                ? "브라우저에서 알림이 차단되어 있어요. 설정에서 허용해 주세요."
                : busy
                  ? "처리 중…"
                  : "멤버가 인증하면 이 기기로 푸시 알림을 받아요."}
          </span>
        </span>
        <Switch
          on={notif === "on"}
          label={
            notif === "loading"
              ? "…"
              : notif === "unsupported"
                ? "지원 안 함"
                : notif === "denied"
                  ? "차단됨"
                  : notif === "on"
                    ? "켜짐"
                    : "꺼짐"
          }
        />
      </button>
    </div>
  );
}
