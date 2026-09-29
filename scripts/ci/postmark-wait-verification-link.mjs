#!/usr/bin/env node
/**
 * Poll Postmark outbound messages for a verification link sent to `recipient`.
 * Requires POSTMARK_SERVER_TOKEN (test environment secret).
 */
const token = process.env.POSTMARK_SERVER_TOKEN?.trim();
const recipient = process.env.POSTMARK_RECIPIENT?.trim()?.toLowerCase();
const timeoutMs = Number(process.env.POSTMARK_WAIT_TIMEOUT_MS ?? 120_000);
const intervalMs = Number(process.env.POSTMARK_POLL_INTERVAL_MS ?? 5_000);

if (!token || !recipient) {
  throw new Error("POSTMARK_SERVER_TOKEN and POSTMARK_RECIPIENT are required");
}

const linkPattern = /https:\/\/[^\s"'<>]+(?:verify|confirm|token|callback|register)[^\s"'<>]*/i;

async function fetchLatestMessage() {
  const url = new URL("https://api.postmarkapp.com/messages/outbound");
  url.searchParams.set("recipient", recipient);
  url.searchParams.set("count", "10");
  url.searchParams.set("offset", "0");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Postmark-Server-Token": token,
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Postmark outbound list failed (${response.status}): ${body.slice(0, 400)}`);
  }
  const payload = await response.json();
  return payload.Messages ?? [];
}

async function fetchMessageHtml(messageId) {
  const response = await fetch(
    `https://api.postmarkapp.com/messages/outbound/${messageId}/details`,
    {
      headers: {
        Accept: "application/json",
        "X-Postmark-Server-Token": token,
      },
    },
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Postmark message details failed (${response.status}): ${body.slice(0, 400)}`);
  }
  const payload = await response.json();
  return `${payload.HtmlBody ?? ""}\n${payload.TextBody ?? ""}`;
}

function extractLink(body) {
  const match = body.match(linkPattern);
  return match?.[0]?.replace(/&amp;/g, "&") ?? null;
}

function messageRecipientEmails(message) {
  const raw = message.Recipients ?? message.To ?? [];
  if (Array.isArray(raw)) {
    return raw.map((entry) => {
      if (typeof entry === "string") return entry.toLowerCase();
      if (entry && typeof entry.Email === "string") return entry.Email.toLowerCase();
      return "";
    });
  }
  if (typeof raw === "string") return [raw.toLowerCase()];
  return [];
}

async function main() {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const messages = await fetchLatestMessage();
    for (const message of messages) {
      if (!messageRecipientEmails(message).includes(recipient)) continue;
      try {
        const body = await fetchMessageHtml(message.MessageID);
        const link = extractLink(body);
        if (link) {
          process.stdout.write(link);
          return;
        }
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("(422)")) {
          throw error;
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`No verification link for ${recipient} within ${timeoutMs}ms`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
