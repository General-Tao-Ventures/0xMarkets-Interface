// #region agent log
const ENDPOINT = "http://127.0.0.1:7587/ingest/b1c8926e-a10d-427b-b2fe-c83ac8368735";
const SESSION_ID = "139a4e";
const RUN_ID = process.env.RUN_ID || "run1";

async function debugLog(hypothesisId, location, message, data) {
  try {
    await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": SESSION_ID },
      body: JSON.stringify({
        sessionId: SESSION_ID,
        runId: RUN_ID,
        hypothesisId,
        location,
        message,
        data,
        timestamp: Date.now(),
      }),
    });
  } catch {}
}
// #endregion

const CRAWLERS = {
  twitter: "Twitterbot/1.0",
  facebook: "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  discord: "Discordbot/2.0 (+https://discordapp.com)",
  telegram: "TelegramBot (like TwitterBot)",
  slack: "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
};

const VERCEL_MARKERS = [
  "vercel.com",
  "vercel.app",
  "DEPLOYMENT_NOT_FOUND",
  "NOT_FOUND",
  "Authentication Required",
  "_vercel/sso",
  "vercel.live",
  "Vercel Authentication",
];

function getMeta(html, key) {
  const re = new RegExp(`<meta[^>]*(?:property|name)\\s*=\\s*["']${key}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  if (!tag) return null;
  return tag.match(/content\s*=\s*["']([^"']*)["']/i)?.[1] ?? null;
}

async function followChain(url, ua, maxHops = 6) {
  const chain = [];
  let current = url;
  for (let hop = 0; hop < maxHops; hop++) {
    const res = await fetch(current, {
      redirect: "manual",
      headers: { "User-Agent": ua, Accept: "text/html,*/*" },
    });
    const location = res.headers.get("location");
    chain.push({
      hop,
      url: current,
      status: res.status,
      location,
      server: res.headers.get("server"),
      contentType: res.headers.get("content-type"),
      xVercelError: res.headers.get("x-vercel-error"),
      xVercelId: res.headers.get("x-vercel-id"),
      xVercelCache: res.headers.get("x-vercel-cache"),
      cfCacheStatus: res.headers.get("cf-cache-status"),
      wwwAuthenticate: res.headers.get("www-authenticate"),
      setCookie: res.headers.has("set-cookie"),
    });
    if (location && res.status >= 300 && res.status < 400) {
      current = new URL(location, current).toString();
      continue;
    }
    const body = await res.text().catch(() => "");
    return { chain, finalUrl: current, res, body };
  }
  return { chain, finalUrl: current, res: null, body: "" };
}

async function probeImage(imageUrl, ua) {
  if (!imageUrl) return null;
  try {
    const res = await fetch(imageUrl, { headers: { "User-Agent": ua } });
    const buf = Buffer.from(await res.arrayBuffer());
    let dims = null;
    if (buf.length > 24 && buf.toString("hex", 0, 8) === "89504e470d0a1a0a") {
      dims = { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
    return {
      url: imageUrl,
      status: res.status,
      contentType: res.headers.get("content-type"),
      bytes: buf.length,
      megabytes: +(buf.length / 1048576).toFixed(2),
      dims,
      isImage: (res.headers.get("content-type") || "").startsWith("image/"),
    };
  } catch (err) {
    return { url: imageUrl, error: String(err) };
  }
}

async function probe(url) {
  for (const [name, ua] of Object.entries(CRAWLERS)) {
    let result;
    try {
      result = await followChain(url, ua);
    } catch (err) {
      await debugLog("H-A", "debug-og-probe.mjs:fetch", "request threw", {
        url,
        crawler: name,
        error: String(err),
      });
      continue;
    }

    const { chain, finalUrl, res, body } = result;
    const final = chain[chain.length - 1];
    const isHtml = (final.contentType || "").includes("html");

    const markersFound = {};
    for (const m of VERCEL_MARKERS) {
      const count = (body.match(new RegExp(m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")) || []).length;
      if (count) markersFound[m] = count;
    }

    const og = {
      ogImage: isHtml ? getMeta(body, "og:image") : null,
      ogTitle: isHtml ? getMeta(body, "og:title") : null,
      ogSiteName: isHtml ? getMeta(body, "og:site_name") : null,
      twitterCard: isHtml ? getMeta(body, "twitter:card") : null,
      twitterImage: isHtml ? getMeta(body, "twitter:image") : null,
    };

    // H-A / H-C: is the crawler being served a Vercel-generated page instead of the app?
    await debugLog("H-A,H-C", "debug-og-probe.mjs:probe", "crawler received response", {
      requestedUrl: url,
      crawler: name,
      finalUrl,
      finalStatus: final.status,
      redirectHops: chain.length - 1,
      redirectChain: chain.map((c) => `${c.status} ${c.url}${c.location ? " -> " + c.location : ""}`),
      xVercelError: final.xVercelError,
      wwwAuthenticate: final.wwwAuthenticate,
      contentType: final.contentType,
      isHtml,
      bodyBytes: body.length,
      bodySnippet: body.slice(0, 400),
      vercelMarkersInBody: markersFound,
      servedByVercelErrorPage: Boolean(final.xVercelError) || final.status === 401,
    });

    // H-B: deep-link path returning NOT_FOUND with zero OG tags
    await debugLog("H-B,H-E", "debug-og-probe.mjs:probe", "og tags visible to crawler", {
      requestedUrl: url,
      crawler: name,
      ...og,
      hasAnyOgImage: Boolean(og.ogImage),
      hasStaticTwitterCard: Boolean(og.twitterCard),
    });

    // H-E: does the advertised og:image actually resolve to a usable image?
    if (og.ogImage) {
      const img = await probeImage(new URL(og.ogImage, finalUrl).toString(), ua);
      await debugLog("H-E", "debug-og-probe.mjs:probeImage", "og:image fetch result", {
        requestedUrl: url,
        crawler: name,
        ...img,
      });
    }
  }
}

const urls = process.argv.slice(2);
if (!urls.length) {
  console.error(
    "Usage: node scripts/debug-og-probe.mjs <url> [moreUrls...]\n" +
      "Pass the EXACT url you paste when sharing the app."
  );
  process.exit(1);
}

for (const url of urls) {
  console.log(`probing ${url} ...`);
  await probe(url);
}
console.log("done - probe results written to .cursor/debug-139a4e.log");
