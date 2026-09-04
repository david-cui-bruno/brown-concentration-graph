/**
 * Scrape course descriptions + seat data from CAB for every course in
 * data/courses.json. Resumable like scrape-prereqs. Output:
 *   data/course-details.json  { [code]: { description, seatsCap, seatsAvail, srcdb, title } }
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { stripHtml, SRCDBS } from "./cab.js";

const DATA = fileURLToPath(new URL("../../data/", import.meta.url));
const OUT = DATA + "course-details.json";

const courses: string[] = JSON.parse(readFileSync(DATA + "courses.json", "utf8"));
const existing: Record<string, unknown> = existsSync(OUT)
  ? JSON.parse(readFileSync(OUT, "utf8"))
  : {};
const todo = courses.filter((c) => !(c in existing));
console.log(`total=${courses.length} todo=${todo.length}`);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("https://cab.brown.edu", { waitUntil: "networkidle" });

let done = 0;
for (const code of todo) {
  try {
    const res = await page.evaluate(
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
              body: JSON.stringify({ group: "code:" + code, key: "crn:" + r0.crn, srcdb, matched: "crn:" + r0.crn }),
            })
          ).json();
          return {
            title: d.title ?? null,
            description: d.description ?? null,
            seats: d.seats ?? null,
            regdemog: d.regdemog_json ?? null,
            srcdb,
          };
        }
        return null;
      },
      { code, srcdbs: SRCDBS }
    );
    if (res) {
      const seatsText = res.seats ? stripHtml(String(res.seats)) : null;
      const m = seatsText?.match(/Max(?:imum)? Enrollment:\s*(\d+)\s*\/\s*Seats Avail(?:able)?:\s*(\d+)/);
      existing[code] = {
        title: res.title ? stripHtml(res.title) : null,
        description: res.description ? stripHtml(res.description) : null,
        seatsCap: m ? parseInt(m[1], 10) : null,
        seatsAvail: m ? parseInt(m[2], 10) : null,
        seatsRaw: seatsText,
        srcdb: res.srcdb,
      };
    } else {
      existing[code] = { title: null, description: null, srcdb: null };
    }
  } catch (e) {
    console.error(`ERROR ${code}: ${e}`);
    existing[code] = { title: null, description: null, srcdb: null, error: true };
  }
  done++;
  if (done % 25 === 0) {
    writeFileSync(OUT, JSON.stringify(existing, null, 1));
    console.log(`JCODE_PROGRESS {"current":${done},"total":${todo.length},"unit":"courses"}`);
  }
  await new Promise((r) => setTimeout(r, 120));
}
writeFileSync(OUT, JSON.stringify(existing, null, 1));
await browser.close();
const withDesc = Object.values(existing).filter((v: any) => v.description).length;
console.log(`done. ${withDesc}/${courses.length} have descriptions`);
