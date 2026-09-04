import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";

const CACHE = fileURLToPath(new URL("../../data/cache/", import.meta.url));

export function cachePath(url: string): string {
  return CACHE + createHash("sha1").update(url).digest("hex") + ".html";
}

export async function fetchCached(url: string): Promise<string> {
  mkdirSync(CACHE, { recursive: true });
  const p = cachePath(url);
  if (existsSync(p)) return readFileSync(p, "utf8");
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (brown-concentration-graph; academic project)",
          Connection: "close",
        },
      });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      const body = await res.text();
      writeFileSync(p, body);
      await new Promise((r) => setTimeout(r, 500)); // be polite
      return body;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

export interface ConcentrationRef {
  slug: string;
  name: string;
  url: string;
}

export function parseIndex(html: string): ConcentrationRef[] {
  const $ = cheerio.load(html);
  const out: ConcentrationRef[] = [];
  $('a[href^="/the-college/concentrations/"]').each((_, a) => {
    const href = $(a).attr("href")!;
    const m = href.match(/^\/the-college\/concentrations\/([a-z]+)\/$/);
    if (m) {
      out.push({
        slug: m[1],
        name: $(a).text().trim(),
        url: `https://bulletin.brown.edu${href}`,
      });
    }
  });
  return [...new Map(out.map((r) => [r.slug, r])).values()];
}
