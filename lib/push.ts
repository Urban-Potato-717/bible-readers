import webpush from "web-push";
import { supabaseAdmin } from "./supabase";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT;

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  if (!publicKey || !privateKey || !subject) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

// Sends a notification to every device of the given users. Expired/invalid
// subscriptions (404/410) are pruned. Never throws — failures are logged so
// callers can fire-and-forget without affecting their own success path.
export async function sendToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  if (userIds.length === 0) return;
  if (!ensureConfigured()) {
    console.warn("[push] VAPID keys not set, skipping notification");
    return;
  }

  const { data: subs, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", userIds);
  if (error || !subs?.length) return;

  const body = JSON.stringify(payload);
  const stale: string[] = [];

  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body
        );
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          stale.push(s.endpoint);
        } else {
          console.warn("[push] send failed", code, (err as Error).message);
        }
      }
    })
  );

  if (stale.length) {
    await supabaseAdmin.from("push_subscriptions").delete().in("endpoint", stale);
  }
}
