/*
 * Local stand-in for the Vercel functions under `api/partner`.
 *
 * `vite dev` does not run serverless functions, so without this the partner endpoints only exist
 * once deployed. This imports the *same* handler modules rather than reimplementing them, so what
 * you test locally is the code that ships.
 *
 *   PARTNER_DATABASE_URL=... PARTNER_SESSION_SECRET=... yarn tsx scripts/partner-dev-server.ts
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import adminContactsHandler from "../api/partner/admin-contacts";
import contactHandler from "../api/partner/contact";
import contactStartHandler from "../api/partner/contact-start";
import contactVerifyHandler from "../api/partner/contact-verify";
import nonceHandler from "../api/partner/nonce";
import sessionHandler from "../api/partner/session";

const PORT = Number(process.env.PARTNER_DEV_PORT ?? 3020);

const ROUTES: Record<string, any> = {
  "/api/partner/nonce": nonceHandler,
  "/api/partner/session": sessionHandler,
  "/api/partner/contact": contactHandler,
  "/api/partner/contact-start": contactStartHandler,
  "/api/partner/contact-verify": contactVerifyHandler,
  "/api/partner/admin-contacts": adminContactsHandler,
};

/** Pull PARTNER_* out of a .env file so the server can be started without exporting anything. */
function loadEnv(file: string) {
  try {
    for (const line of readFileSync(resolve(process.cwd(), file), "utf8").split("\n")) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* no .env is fine — env vars may come from the shell */
  }
}

loadEnv(".env.partner");
loadEnv(".env.local");

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const handler = ROUTES[url.pathname];

  if (!handler) {
    res.writeHead(404, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Not found" }));
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString();

  // Shim the two bits of the Vercel request/response contract the handlers actually use.
  const vercelReq: any = Object.assign(req, {
    body: raw ? safeParse(raw) : undefined,
    query: Object.fromEntries(url.searchParams),
  });
  const vercelRes: any = Object.assign(res, {
    status(code: number) {
      res.statusCode = code;
      return vercelRes;
    },
    json(payload: unknown) {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(payload));
      return vercelRes;
    },
    send(payload: string) {
      res.end(payload);
      return vercelRes;
    },
  });

  try {
    await handler(vercelReq, vercelRes);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[partner-dev] unhandled", error);
    if (!res.writableEnded) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Something went wrong. Try again." }));
    }
  }
});

function safeParse(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[partner-dev] listening on http://localhost:${PORT}`);
  if (process.env.PARTNER_DEV_ECHO_CODE === "1") {
    // eslint-disable-next-line no-console
    console.log("[partner-dev] PARTNER_DEV_ECHO_CODE is on — verification codes are returned to the browser");
  }
});
