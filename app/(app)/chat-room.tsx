"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { REACTION_EMOJIS, MESSAGE_PAGE_SIZE, type FeedMessage } from "@/lib/chat";

type Props = {
  meId: string;
  today: string;
  initialMessages: FeedMessage[];
  verifiedToday: boolean;
};

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
  const [messages, setMessages] = useState<FeedMessage[]>(initialMessages);
  const [verifiedToday, setVerifiedToday] = useState(verifiedInit);
  const [hasOlder, setHasOlder] = useState(
    initialMessages.length >= MESSAGE_PAGE_SIZE
  );
  const [showVerify, setShowVerify] = useState(false);
  const [reactingId, setReactingId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  // Poll every 3s.
  useEffect(() => {
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [refresh]);

  // Initial scroll to bottom.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, []);

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

  return (
    <div className="flex flex-col h-full">
      {/* verify status banner */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-md mx-auto px-4 py-2 flex items-center justify-between">
          {verifiedToday ? (
            <span className="text-sm text-emerald-700 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
              오늘 인증 완료
            </span>
          ) : (
            <span className="text-sm text-slate-500">아직 오늘 인증 전이에요</span>
          )}
          <button
            onClick={() => setShowVerify(true)}
            className="text-sm font-medium rounded-lg bg-slate-900 text-white px-3 py-1.5"
          >
            {verifiedToday ? "다시 인증" : "인증 제출"}
          </button>
        </div>
      </div>

      {/* feed */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto px-3 py-4 space-y-1">
          {hasOlder && (
            <div className="text-center py-2">
              <button
                onClick={loadOlder}
                className="text-xs text-slate-500 bg-white border border-slate-200 rounded-full px-3 py-1"
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
                    <span className="text-[11px] text-slate-400 bg-slate-100 rounded-full px-2.5 py-1">
                      {dayLabel(m.created_at)}
                    </span>
                  </div>
                )}
                <Bubble
                  m={m}
                  mine={m.user_id === meId}
                  picking={reactingId === m.id}
                  onPick={() => setReactingId(reactingId === m.id ? null : m.id)}
                  onReact={(e) => toggleReaction(m.id, e)}
                />
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* composer */}
      <Composer onSent={refresh} />

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
  onPick,
  onReact,
}: {
  m: FeedMessage;
  mine: boolean;
  picking: boolean;
  onPick: () => void;
  onReact: (emoji: string) => void;
}) {
  const isVer = m.kind === "verification";
  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"} mb-1`}>
      {!mine && (
        <span className="text-xs text-slate-500 ml-1 mb-0.5">{m.user_name}</span>
      )}
      <div className={`flex items-end gap-1 ${mine ? "flex-row-reverse" : ""}`}>
        <button
          onClick={onPick}
          className={`max-w-[78vw] sm:max-w-xs rounded-2xl px-3 py-2 text-left ${
            isVer
              ? "bg-emerald-50 border border-emerald-300"
              : mine
                ? "bg-slate-900 text-white"
                : "bg-white border border-slate-200"
          }`}
        >
          {isVer && (
            <span className="inline-block text-[11px] font-medium text-emerald-700 mb-1">
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
        <span className="text-[10px] text-slate-400 shrink-0">
          {timeLabel(m.created_at)}
        </span>
      </div>

      {/* reactions */}
      {(m.reactions.length > 0 || picking) && (
        <div className={`flex flex-wrap gap-1 mt-1 ${mine ? "justify-end" : ""}`}>
          {m.reactions.map((r) => (
            <button
              key={r.emoji}
              onClick={() => onReact(r.emoji)}
              className={`text-xs rounded-full px-2 py-0.5 border ${
                r.mine
                  ? "bg-amber-50 border-amber-300"
                  : "bg-white border-slate-200"
              }`}
            >
              {r.emoji} {r.count}
            </button>
          ))}
          {picking &&
            REACTION_EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => onReact(e)}
                className="text-base rounded-full px-1.5 py-0.5 bg-white border border-slate-200"
              >
                {e}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

function Composer({ onSent }: { onSent: () => void }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);

  async function send() {
    if ((!text.trim() && !file) || sending) return;
    setSending(true);
    try {
      const fd = new FormData();
      fd.set("body", text);
      if (file) fd.set("photo", file);
      const res = await fetch("/api/messages", { method: "POST", body: fd });
      if (res.ok) {
        setText("");
        setFile(null);
        onSent();
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="border-t border-slate-200 bg-white">
      <div className="max-w-md mx-auto px-3 py-2">
        {file && (
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1 px-1">
            <span>사진 첨부: {file.name}</span>
            <button onClick={() => setFile(null)} className="text-slate-400">
              취소
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <label className="shrink-0 cursor-pointer rounded-full bg-slate-100 w-9 h-9 flex items-center justify-center text-slate-600">
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
            className="flex-1 resize-none rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm max-h-28"
          />
          <button
            onClick={send}
            disabled={sending || (!text.trim() && !file)}
            className="shrink-0 rounded-full bg-slate-900 text-white px-4 h-9 text-sm font-medium disabled:opacity-40"
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
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-lg">오늘 인증 제출</h2>
          <button onClick={onClose} className="text-slate-400 text-sm">
            닫기
          </button>
        </div>
        <p className="text-xs text-slate-500 -mt-2">
          나눔 글이나 사진을 올리면 인증으로 채팅방에 올라갑니다.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="예: 창세기 1-3장 / 오늘의 나눔..."
          className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <label className="block">
          <span className="text-sm font-medium">사진 (선택)</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-slate-700"
          />
        </label>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
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
