import { supabaseAdmin, VERIFICATION_BUCKET } from "./supabase";
import { MESSAGE_PAGE_SIZE, type FeedMessage } from "./chat";

type Opts = {
  meId: string;
  before?: string | null; // created_at cursor -> older messages
  after?: string | null; // created_at cursor -> newer messages (polling)
};

type Row = {
  id: string;
  user_id: string;
  kind: "chat" | "verification";
  body: string | null;
  photo_path: string | null;
  date: string | null;
  created_at: string;
  users: { name: string } | null;
  reactions: { emoji: string; user_id: string }[];
};

const SELECT =
  "id, user_id, kind, body, photo_path, date, created_at, users(name), reactions(emoji, user_id)";

const SIGN_TTL_SECONDS = 60 * 60; // Supabase signed-URL lifetime.
// Reuse signed URLs across requests (warm function instance) so polling
// doesn't re-sign every photo every few seconds. Refreshed before expiry.
const SIGN_CACHE_TTL_MS = 50 * 60 * 1000;
const signedCache = new Map<string, { url: string; expires: number }>();

async function signPaths(paths: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const now = Date.now();
  const missing: string[] = [];
  for (const p of paths) {
    const cached = signedCache.get(p);
    if (cached && cached.expires > now) result.set(p, cached.url);
    else {
      if (cached) signedCache.delete(p);
      missing.push(p);
    }
  }
  if (missing.length > 0) {
    const { data: signed } = await supabaseAdmin.storage
      .from(VERIFICATION_BUCKET)
      .createSignedUrls(missing, SIGN_TTL_SECONDS);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) {
        signedCache.set(s.path, { url: s.signedUrl, expires: now + SIGN_CACHE_TTL_MS });
        result.set(s.path, s.signedUrl);
      }
    }
  }
  return result;
}

/** Loads a page of feed messages (always returned oldest -> newest). */
export async function loadFeed({ meId, before, after }: Opts): Promise<FeedMessage[]> {
  let query = supabaseAdmin.from("messages").select(SELECT);

  if (after) {
    query = query
      .gt("created_at", after)
      .order("created_at", { ascending: true })
      .limit(MESSAGE_PAGE_SIZE);
  } else {
    if (before) query = query.lt("created_at", before);
    query = query.order("created_at", { ascending: false }).limit(MESSAGE_PAGE_SIZE);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  const rows = data as unknown as Row[];

  // Sign photo URLs (cached across requests, deduped).
  const paths = [
    ...new Set(rows.map((r) => r.photo_path).filter((p): p is string => !!p)),
  ];
  const urlByPath = paths.length > 0 ? await signPaths(paths) : new Map<string, string>();

  const mapped: FeedMessage[] = rows.map((r) => {
    const byEmoji = new Map<string, { count: number; mine: boolean }>();
    for (const re of r.reactions ?? []) {
      const cur = byEmoji.get(re.emoji) ?? { count: 0, mine: false };
      cur.count += 1;
      if (re.user_id === meId) cur.mine = true;
      byEmoji.set(re.emoji, cur);
    }
    return {
      id: r.id,
      user_id: r.user_id,
      user_name: r.users?.name ?? "?",
      kind: r.kind,
      body: r.body,
      photo_url: r.photo_path ? urlByPath.get(r.photo_path) ?? null : null,
      date: r.date,
      created_at: r.created_at,
      reactions: [...byEmoji.entries()].map(([emoji, v]) => ({ emoji, ...v })),
    };
  });

  // `after`/`before` queries may come back descending; normalize to ascending.
  mapped.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return mapped;
}
