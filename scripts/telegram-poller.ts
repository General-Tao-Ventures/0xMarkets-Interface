/*
 * Local stand-in for Telegram's webhook.
 *
 * Telegram can deliver updates two ways: it POSTs to a public HTTPS URL (webhook), or the bot asks
 * for them (long polling). Webhooks need a tunnel, and free tunnels are unreliable — so for local
 * work this polls instead and feeds each update into the SAME webhook handler that runs in
 * production. The code path being tested is therefore identical; only the transport differs.
 *
 *   yarn tsx scripts/telegram-poller.ts
 *
 * Do not run this at the same time as a registered webhook: Telegram refuses getUpdates while one
 * is set, so the script deletes any webhook on startup.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import handler from "../api/partner/telegram-webhook";

function loadEnv(file: string) {
  try {
    for (const line of readFileSync(resolve(process.cwd(), file), "utf8").split("\n")) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!m || process.env[m[1]]) continue;
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* env may come from the shell */
  }
}
loadEnv(".env.partner");
loadEnv(".env.local");

const TOKEN = process.env.PARTNER_TELEGRAM_BOT_TOKEN;
const SECRET = process.env.PARTNER_TELEGRAM_WEBHOOK_SECRET;
if (!TOKEN) throw new Error("PARTNER_TELEGRAM_BOT_TOKEN is not set in .env.partner");
if (!SECRET) throw new Error("PARTNER_TELEGRAM_WEBHOOK_SECRET is not set in .env.partner");

const api = (method: string, body?: unknown) =>
  fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  }).then((r) => r.json() as Promise<any>);

/** Hand the update to the real handler through the same shape Vercel would give it. */
async function deliver(update: unknown) {
  const req: any = {
    method: "POST",
    headers: { "x-telegram-bot-api-secret-token": SECRET },
    body: update,
    query: {},
  };
  let status = 0;
  const res: any = {
    setHeader: () => res,
    status(code: number) {
      status = code;
      return res;
    },
    json(payload: unknown) {
      // eslint-disable-next-line no-console
      console.log(`   -> ${status} ${JSON.stringify(payload)}`);
      return res;
    },
    redirect: () => res,
    end: () => res,
  };
  await handler(req, res);
}

async function main() {
  const me = await api("getMe");
  if (!me.ok) throw new Error(`getMe failed: ${JSON.stringify(me)}`);
  // eslint-disable-next-line no-console
  console.log(`[telegram-poller] connected as @${me.result.username}`);

  // getUpdates and a webhook are mutually exclusive.
  await api("deleteWebhook", { drop_pending_updates: false });

  let offset: number | undefined;
  for (;;) {
    try {
      const res = await api("getUpdates", { offset, timeout: 25, allowed_updates: ["message"] });
      if (!res.ok) {
        // eslint-disable-next-line no-console
        console.error("[telegram-poller]", res.description);
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      for (const update of res.result ?? []) {
        offset = update.update_id + 1;
        const text = update.message?.text ?? "";
        // eslint-disable-next-line no-console
        console.log(`[telegram-poller] @${update.message?.from?.username ?? "?"}: ${text}`);
        await deliver(update);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[telegram-poller] poll failed", error);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

void main();
