import { writeFileSync } from "node:fs";
import { fetchCached, parseIndex } from "./fetch.js";

const html = await fetchCached("https://bulletin.brown.edu/the-college/concentrations/");
const rows = parseIndex(html);
writeFileSync(
  new URL("../../data/concentrations.json", import.meta.url),
  JSON.stringify(rows, null, 2)
);
console.log(`wrote ${rows.length} concentrations to data/concentrations.json`);
