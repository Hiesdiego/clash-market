/**
 * Minimal, real alerting: POSTs to a webhook URL (Slack/Discord both
 * accept a simple `{ text }` or `{ content }` JSON body at an
 * incoming-webhook URL — this uses Slack's shape since it's the more
 * common ops default; swap the body shape if using Discord instead).
 * Not a stub — if ALERT_WEBHOOK_URL is set, this actually sends a
 * message. If it's unset, alerts log to console only, which is fine
 * for local dev but means production without a configured webhook is
 * running with monitoring in name only — set the env var.
 */
export async function alert(message: string) {
  console.error(`[ALERT] ${message}`);

  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `\uD83D\uDEA8 Clash Markets worker: ${message}` }),
    });
  } catch (err) {
    console.error("[worker] Failed to send alert webhook:", err);
  }
}
