export const REACTION_EMOJIS = ["👍", "❤️", "🙏", "😂"] as const;

// Whitelist raster image types only. Excludes SVG, which can carry scripts that
// execute when a signed URL is opened directly in the browser.
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const MESSAGE_PAGE_SIZE = 50;

// Auto-cleanup windows (days).
export const PHOTO_RETENTION_DAYS = 30;
export const CHAT_RETENTION_DAYS = 90;

export type FeedMessage = {
  id: string;
  user_id: string;
  user_name: string;
  kind: "chat" | "verification";
  body: string | null;
  photo_url: string | null;
  date: string | null;
  created_at: string;
  reactions: { emoji: string; count: number; mine: boolean }[];
};
