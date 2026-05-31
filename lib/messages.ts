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

/** Loads a page of feed messages (always returned oldest -> newest). */
export async function loadFeed({ meId, before, after }: Opts): Promise<FeedMessage[]> {
  let query = supabaseAdmin.from("messages").select(SELECT);

  if (after) {
    query = query.gt("created_at", after).order("created_at", { ascending: true });
  } else {
    if (before) query = query.lt("created_at", before);
    query = query.order("created_at", { ascending: false }).limit(MESSAGE_PAGE_SIZE);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  const rows = data as unknown as Row[];

  // Sign photo URLs in one batch.
  const paths = rows.map((r) => r.photo_path).filter((p): p is string => !!p);
  const urlByPath = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await supabaseAdmin.storage
      .from(VERIFICATION_BUCKET)
      .createSignedUrls(paths, 60 * 60);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
    }
  }

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
