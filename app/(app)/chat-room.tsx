"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { REACTION_EMOJIS, MESSAGE_PAGE_SIZE, type FeedMessage } from "@/lib/chat";

type Props = {
  meId: string;
  today: string;
  initialMessages: FeedMessage[];
  verifiedToday: boolean;
};

type LocalMessage = FeedMessage & { pending?: boolean; failed?: boolean };

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dayLabel(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

export function ChatRoom({
  meId,
  today,
  initialMessages,
  verifiedToday: verifiedInit,
}: Props) {
  const [messages, setMessages] = useState<LocalMessage[]>(initialMessages);
  const [verifiedToday, setVerifiedToday] = useState(verifiedInit);
  const [hasOlder, setHasOlder] = useState(
    initialMessages.length >= MESSAGE_PAGE_SIZE
  );
  const [showVerify, setShowVerify] = useState(false);
  const [reactingId, setReactingId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Whether the view is pinned to the bottom. Starts pinned so opening the app
  // (and returning from another tab) lands on the newest messages, and stays
  // pinned as photos load. Only a deliberate upward scroll unpins it.
  const stick = useRef(true);
  const lastTop = useRef(0);

  // Merge fetched messages into state by id (updates reactions + adds new).
  const merge = useCallback((incoming: FeedMessage[]) => {
    setMessages((prev) => {
      const byId = new Map(prev.map((m) => [m.id, m]));
      for (const m of incoming) byId.set(m.id, m);
      return [...byId.values()].sort((a, b) =>
        a.created_at.localeCompare(b.created_at)
      );
    });
  }, []);

  const isNearBottom = () => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, []);

  // Unpin only on a deliberate upward scroll (scrollTop decreases). Feed growth
  // from loading photos can fire scroll events via the browser's scroll
  // anchoring, but those never decrease scrollTop, so they won't unpin us.
  // Re-pin as soon as the user returns to the bottom.
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const top = el.scrollTop;
    const nearBottom = el.scrollHeight - top - el.clientHeight < 120;
    if (top < lastTop.current - 4 && !nearBottom) stick.current = false;
    else if (nearBottom) stick.current = true;
    lastTop.current = top;
  }, []);

  // Mirror of messages so polling callbacks can read the latest cursor
  // without being re-created on every render.
  const messagesRef = useRef<LocalMessage[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Full reload of the latest page — also syncs reactions/edits on existing
  // messages. Used on send, on mount, and on a slower cadence while polling.
  const refresh = useCallback(async () => {
    const stick = isNearBottom();
    const res = await fetch("/api/messages", { cache: "no-store" });
    if (!res.ok) return;
    const { messages: latest } = await res.json();
    merge(latest);
    if (stick)
      requestAnimationFrame(() =>
        bottomRef.current?.scrollIntoView({ block: "end" })
      );
  }, [merge]);

  // Incremental poll: fetch only messages newer than the newest real one.
  const pollNew = useCallback(async () => {
    const reals = messagesRef.current.filter((m) => !m.pending && !m.failed);
    const cursor = reals.length ? reals[reals.length - 1].created_at : null;
    if (!cursor) return refresh();
    const stick = isNearBottom();
    const res = await fetch(`/api/messages?after=${encodeURIComponent(cursor)}`, {
      cache: "no-store",
    });
    if (!res.ok) return;
    const { messages: fresh } = (await res.json()) as { messages: LocalMessage[] };
    if (fresh.length > 0) {
      merge(fresh);
      if (stick)
        requestAnimationFrame(() =>
          bottomRef.current?.scrollIntoView({ block: "end" })
        );
    }
  }, [merge, refresh]);

  // Keeps body/file for each optimistic message so a failed send can be retried.
  const pendingPayloads = useRef<Map<string, { body: string; file: File | null }>>(
    new Map()
  );

  const postMessage = useCallback(
    async (tempId: string, body: string, file: File | null) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...m, pending: true, failed: false } : m
        )
      );
      try {
        const fd = new FormData();
        fd.set("body", body);
        if (file) fd.set("photo", file);
        const res = await fetch("/api/messages", { method: "POST", body: fd });
        if (!res.ok) throw new Error("send failed");
        pendingPayloads.current.delete(tempId);
        setMessages((prev) => {
          const temp = prev.find((m) => m.id === tempId);
          if (temp?.photo_url?.startsWith("blob:"))
            URL.revokeObjectURL(temp.photo_url);
          return prev.filter((m) => m.id !== tempId);
        });
        refresh();
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...m, pending: false, failed: true } : m
          )
        );
      }
    },
    [refresh]
  );

  const sendMessage = useCallback(
    (text: string, file: File | null) => {
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const optimistic: LocalMessage = {
        id: tempId,
        user_id: meId,
        user_name: "",
        kind: "chat",
        body: text.trim() ? text : null,
        photo_url: file ? URL.createObjectURL(file) : null,
        date: null,
        created_at: new Date().toISOString(),
        reactions: [],
        pending: true,
      };
      pendingPayloads.current.set(tempId, { body: text, file });
      setMessages((prev) => [...prev, optimistic]);
      requestAnimationFrame(() =>
        bottomRef.current?.scrollIntoView({ block: "end" })
      );
      postMessage(tempId, text, file);
    },
    [meId, postMessage]
  );

  const retryMessage = useCallback(
    (tempId: string) => {
      const payload = pendingPayloads.current.get(tempId);
      if (payload) postMessage(tempId, payload.body, payload.file);
    },
    [postMessage]
  );

  // Poll every 3s for new messages; every 5th tick (15s) do a full refresh
  // so reactions/edits on existing messages stay in sync.
  useEffect(() => {
    let ticks = 0;
    const t = setInterval(() => {
      ticks += 1;
      if (ticks % 5 === 0) refresh();
      else pollNew();
    }, 3000);
    return () => clearInterval(t);
  }, [refresh, pollNew]);

  // Initial scroll to bottom.
  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  // Keep pinned to the newest message: whenever the feed grows (photos loading,
  // new messages, font swaps) while pinned, snap back to the bottom. A
  // ResizeObserver catches every size change reliably, unlike per-image onLoad.
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const ro = new ResizeObserver(() => {
      if (stick.current) scrollToBottom();
    });
    ro.observe(content);
    return () => ro.disconnect();
  }, [scrollToBottom]);

  async function loadOlder() {
    const first = messages[0];
    if (!first) return;
    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    const res = await fetch(
      `/api/messages?before=${encodeURIComponent(first.created_at)}`,
      { cache: "no-store" }
    );
    if (!res.ok) return;
    const { messages: older } = (await res.json()) as { messages: FeedMessage[] };
    if (older.length < MESSAGE_PAGE_SIZE) setHasOlder(false);
    if (older.length > 0) {
      merge(older);
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevHeight;
      });
    }
  }

  async function toggleReaction(messageId: string, emoji: string) {
    setReactingId(null);
    await fetch("/api/reactions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messageId, emoji }),
    });
    refresh();
  }

  async function deleteMessage(messageId: string) {
    setMenuId(null);
    // Optimistically remove; refresh reconciles if the server rejects.
    const removed = messagesRef.current.find((m) => m.id === messageId);
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    const res = await fetch(`/api/messages?id=${encodeURIComponent(messageId)}`, {
      method: "DELETE",
    });
    if (!res.ok && removed) refresh();
  }

  return (
    <div className="flex flex-col h-full">
      {/* verify status banner */}
      <div className="bg-white border-b border-slate-200 dark:bg-slate-900 dark:border-slate-800">
        <div className="max-w-md mx-auto px-4 py-2 flex items-center justify-between">
          {verifiedToday ? (
            <span className="text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
              오늘 인증 완료
            </span>
          ) : (
            <span className="text-sm text-slate-500 dark:text-slate-400">
              아직 오늘 인증 전이에요
            </span>
          )}
          <button
            onClick={() => setShowVerify(true)}
            className="text-sm font-medium rounded-lg bg-slate-900 text-white px-3 py-1.5 dark:bg-slate-100 dark:text-slate-900"
          >
            {verifiedToday ? "다시 인증" : "인증 제출"}
          </button>
        </div>
      </div>

      {/* feed */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
        <div ref={contentRef} className="max-w-md mx-auto px-3 py-4 space-y-1">
          {hasOlder && (
            <div className="text-center py-2">
              <button
                onClick={loadOlder}
                className="text-xs text-slate-500 bg-white border border-slate-200 rounded-full px-3 py-1 dark:text-slate-400 dark:bg-slate-800 dark:border-slate-700"
              >
                이전 메시지 더보기
              </button>
            </div>
          )}
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const showDay =
              !prev ||
              new Date(prev.created_at).toDateString() !==
                new Date(m.created_at).toDateString();
            return (
              <div key={m.id}>
                {showDay && (
                  <div className="text-center my-3">
                    <span className="text-[11px] text-slate-400 bg-slate-100 rounded-full px-2.5 py-1 dark:text-slate-500 dark:bg-slate-800">
                      {dayLabel(m.created_at)}
                    </span>
                  </div>
                )}
                <Bubble
                  m={m}
                  mine={m.user_id === meId}
                  picking={reactingId === m.id}
                  menuOpen={menuId === m.id}
                  canDelete={m.user_id === meId && m.kind === "chat"}
                  onPick={() => {
                    setMenuId(null);
                    setReactingId(reactingId === m.id ? null : m.id);
                  }}
                  onLongPress={() => {
                    setReactingId(null);
                    setMenuId(m.id);
                  }}
                  onCloseMenu={() => setMenuId(null)}
                  onDelete={() => deleteMessage(m.id)}
                  onReact={(e) => toggleReaction(m.id, e)}
                  onRetry={() => retryMessage(m.id)}
                />
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* composer */}
      <Composer onSend={sendMessage} />

      {showVerify && (
        <VerifySheet
          date={today}
          onClose={() => setShowVerify(false)}
          onDone={() => {
            setShowVerify(false);
            setVerifiedToday(true);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function Bubble({
  m,
  mine,
  picking,
  menuOpen,
  canDelete,
  onPick,
  onLongPress,
  onCloseMenu,
  onDelete,
  onReact,
  onRetry,
}: {
  m: LocalMessage;
  mine: boolean;
  picking: boolean;
  menuOpen: boolean;
  canDelete: boolean;
  onPick: () => void;
  onLongPress: () => void;
  onCloseMenu: () => void;
  onDelete: () => void;
  onReact: (emoji: string) => void;
  onRetry: () => void;
}) {
  const isVer = m.kind === "verification";
  const interactive = !m.pending && !m.failed;

  // Long-press (~500ms) opens the delete menu; a normal tap opens the emoji
  // picker. longFired suppresses the click that fires after a long press.
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longFired = useRef(false);

  function startPress() {
    if (!interactive || !canDelete) return;
    longFired.current = false;
    pressTimer.current = setTimeout(() => {
      longFired.current = true;
      onLongPress();
    }, 500);
  }
  function cancelPress() {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }
  function handleClick() {
    if (!interactive) return;
    if (longFired.current) {
      longFired.current = false;
      return;
    }
    onPick();
  }

  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"} mb-1`}>
      {!mine && (
        <span className="text-xs text-slate-500 dark:text-slate-400 ml-1 mb-0.5">
          {m.user_name}
        </span>
      )}
      <div className={`flex items-end gap-1 ${mine ? "flex-row-reverse" : ""}`}>
        <button
          onClick={handleClick}
          onPointerDown={startPress}
          onPointerUp={cancelPress}
          onPointerLeave={cancelPress}
          onPointerCancel={cancelPress}
          onPointerMove={cancelPress}
          onContextMenu={(e) => e.preventDefault()}
          className={`max-w-[78vw] sm:max-w-xs rounded-2xl px-3 py-2 text-left ${
            isVer
              ? "bg-emerald-50 border border-emerald-300 dark:bg-emerald-950 dark:border-emerald-800 dark:text-slate-100"
              : mine
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                : "bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
          } ${m.pending ? "opacity-60" : ""}`}
        >
          {isVer && (
            <span className="inline-block text-[11px] font-medium text-emerald-700 dark:text-emerald-400 mb-1">
              ✓ 인증
            </span>
          )}
          {m.body && (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
              {m.body}
            </p>
          )}
          {m.photo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={m.photo_url}
              alt="사진"
              className="mt-1 rounded-lg max-h-72 w-auto"
            />
          )}
        </button>
        {m.pending ? (
          <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
            전송중…
          </span>
        ) : m.failed ? (
          <button
            onClick={onRetry}
            className="text-[10px] text-red-500 dark:text-red-400 shrink-0 underline"
          >
            전송 실패 · 다시 시도
          </button>
        ) : (
          <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
            {timeLabel(m.created_at)}
          </span>
        )}
      </div>

      {/* existing reactions (fixed row) */}
      {m.reactions.length > 0 && (
        <div className={`flex flex-wrap gap-1 mt-1 ${mine ? "justify-end" : ""}`}>
          {m.reactions.map((r) => (
            <button
              key={r.emoji}
              onClick={() => onReact(r.emoji)}
              className={`text-xs rounded-full px-2 py-0.5 border ${
                r.mine
                  ? "bg-amber-50 border-amber-300 dark:bg-amber-950 dark:border-amber-800"
                  : "bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700"
              }`}
            >
              {r.emoji} {r.count}
            </button>
          ))}
        </div>
      )}

      {/* emoji picker (separate row below, so it doesn't shift existing reactions) */}
      {picking && (
        <div className={`flex flex-wrap gap-1 mt-1 ${mine ? "justify-end" : ""}`}>
          {REACTION_EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => onReact(e)}
              className="text-base rounded-full px-1.5 py-0.5 bg-white border border-slate-200 shadow-sm dark:bg-slate-800 dark:border-slate-700"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {/* delete confirmation (long-press menu) */}
      {menuOpen && (
        <div className={`flex items-center gap-1.5 mt-1 ${mine ? "justify-end" : ""}`}>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            이 메시지를 삭제할까요?
          </span>
          <button
            onClick={onDelete}
            className="text-xs font-medium rounded-full bg-red-500 text-white px-3 py-1"
          >
            삭제
          </button>
          <button
            onClick={onCloseMenu}
            className="text-xs rounded-full bg-white border border-slate-200 px-3 py-1 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
          >
            취소
          </button>
        </div>
      )}
    </div>
  );
}

function Composer({
  onSend,
}: {
  onSend: (text: string, file: File | null) => void;
}) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);

  function send() {
    if (!text.trim() && !file) return;
    onSend(text, file);
    setText("");
    setFile(null);
  }

  return (
    <div className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="max-w-md mx-auto px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        {file && (
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1 px-1">
            <span>사진 첨부: {file.name}</span>
            <button onClick={() => setFile(null)} className="text-slate-400 dark:text-slate-500">
              취소
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <label className="shrink-0 cursor-pointer rounded-full bg-slate-100 w-9 h-9 flex items-center justify-center text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            ＋
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder="메시지 입력"
            className="flex-1 resize-none rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm max-h-28 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          <button
            onClick={send}
            disabled={!text.trim() && !file}
            className="shrink-0 rounded-full bg-slate-900 text-white px-4 h-9 text-sm font-medium disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900"
          >
            전송
          </button>
        </div>
      </div>
    </div>
  );
}

function VerifySheet({
  date,
  onClose,
  onDone,
}: {
  date: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!text.trim() && !file) {
      setError("읽은 장을 적거나 사진을 올려주세요");
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.set("date", date);
      fd.set("text", text);
      if (file) fd.set("photo", file);
      const res = await fetch("/api/verify", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "인증 실패");
        return;
      }
      onDone();
    } catch {
      setError("네트워크 오류");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-5 space-y-4 dark:bg-slate-900 dark:text-slate-100">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-lg">오늘 인증 제출</h2>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 text-sm">
            닫기
          </button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2">
          나눔 글이나 사진을 올리면 인증으로 채팅방에 올라갑니다.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="예: 창세기 1-3장 / 오늘의 나눔..."
          className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
        <label className="block">
          <span className="text-sm font-medium">사진 (선택)</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-slate-700 dark:text-slate-300 dark:file:bg-slate-800 dark:file:text-slate-200"
          />
        </label>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 dark:text-red-300 dark:bg-red-950 dark:border-red-900">
            {error}
          </p>
        )}
        <button
          onClick={submit}
          disabled={loading}
          className="w-full rounded-lg bg-emerald-600 text-white py-3 font-medium disabled:opacity-50"
        >
          {loading ? "올리는 중..." : "인증 제출"}
        </button>
      </div>
    </div>
  );
}
