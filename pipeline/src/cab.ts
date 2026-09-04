import { chromium, type Browser, type Page } from "playwright";

/** Terms to try, newest first. Courses not offered in a term have no data there. */
export const SRCDBS = [
  "202610", "202620", "202600", "202510", "202520", "202515",
  "202410", "202420", "202415", "202310", "202320",
];

export interface CabResult {
  code: string;
  title: string | null;
  /** registration_restrictions HTML stripped to text; null if none listed */
  text: string | null;
  srcdb: string | null; // term the data came from; null = not found in any term
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|\u00a0/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract the prerequisite sentence(s) from registration_restrictions text. */
export function extractPrereqText(restrictions: string | null | undefined): string | null {
  if (!restrictions) return null;
  const text = stripHtml(restrictions);
  const m = text.match(/Prerequisites?:.*?(?=(?:Enrollment limited|Instructor permission|$))/is);
  return m ? m[0].trim() : null;
}

export class CabSession {
  private browser!: Browser;
  private page!: Page;

  async open(): Promise<void> {
    this.browser = await chromium.launch();
    this.page = await this.browser.newPage();
    await this.page.goto("https://cab.brown.edu", { waitUntil: "networkidle" });
  }

  /** Look up a course across terms, newest first. Runs in page context (same-origin). */
  async lookup(code: string): Promise<CabResult> {
    const res = await this.page.evaluate(
      async ({ code, srcdbs }) => {
        for (const srcdb of srcdbs) {
          const s = await (
            await fetch("/api/?page=fose&route=search", {
              method: "POST",
              body: JSON.stringify({ other: { srcdb }, criteria: [{ field: "code", value: code }] }),
            })
          ).json();
          const r0 = s.results?.find((r: any) => r.code === code && r.stat !== "X");
          if (!r0) continue;
          const d = await (
            await fetch("/api/?page=fose&route=details", {
              method: "POST",
              body: JSON.stringify({
                group: "code:" + code,
                key: "crn:" + r0.crn,
                srcdb,
                matched: "crn:" + r0.crn,
              }),
            })
          ).json();
          return {
            restrictions: (d.registration_restrictions as string) ?? null,
            title: (d.title as string) ?? null,
            srcdb,
          };
        }
        return null;
      },
      { code, srcdbs: SRCDBS }
    );
    if (!res) return { code, title: null, text: null, srcdb: null };
    return {
      code,
      title: res.title,
      text: extractPrereqText(res.restrictions),
      srcdb: res.srcdb,
    };
  }

  async close(): Promise<void> {
    await this.browser?.close();
  }
}
