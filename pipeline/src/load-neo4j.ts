/**
 * Idempotent loader: web/public/graph.json -> Neo4j AuraDB.
 *
 * Setup: create a free instance at https://console.neo4j.io, then put in
 * pipeline/.env:
 *   NEO4J_URI=neo4j+s://xxxx.databases.neo4j.io
 *   NEO4J_USER=neo4j
 *   NEO4J_PASSWORD=...
 *
 * Run: npx tsx src/load-neo4j.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import neo4j from "neo4j-driver";

const envPath = fileURLToPath(new URL("../.env", import.meta.url));
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const { NEO4J_URI, NEO4J_USER = "neo4j", NEO4J_PASSWORD } = process.env;
if (!NEO4J_URI || !NEO4J_PASSWORD) {
  console.error("Missing NEO4J_URI / NEO4J_PASSWORD (see pipeline/.env.example). Skipping.");
  process.exit(1);
}

const data = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../web/public/graph.json", import.meta.url)), "utf8")
);

const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));
const session = driver.session();

const courses = data.nodes.filter((n: any) => n.kind === "course");
const concs = data.nodes.filter((n: any) => n.kind === "concentration");
const groups = data.nodes.filter((n: any) => n.kind === "reqgroup");

try {
  await session.run("CREATE CONSTRAINT course_code IF NOT EXISTS FOR (c:Course) REQUIRE c.code IS UNIQUE");
  await session.run("CREATE CONSTRAINT conc_id IF NOT EXISTS FOR (c:Concentration) REQUIRE c.id IS UNIQUE");
  await session.run("CREATE CONSTRAINT rg_id IF NOT EXISTS FOR (r:ReqGroup) REQUIRE r.id IS UNIQUE");

  const batch = async (query: string, rows: any[], size = 1000) => {
    for (let i = 0; i < rows.length; i += size) {
      await session.run(query, { rows: rows.slice(i, i + size) });
    }
  };

  await batch(
    `UNWIND $rows AS r MERGE (c:Course {code: r.id})
     SET c.title = r.label, c.dept = r.dept, c.prereqText = r.prereqText`,
    courses
  );
  await batch(
    `UNWIND $rows AS r MERGE (c:Concentration {id: r.id})
     SET c.name = r.label, c.slug = r.slug, c.degree = r.degree`,
    concs
  );
  await batch(
    `UNWIND $rows AS r MERGE (g:ReqGroup {id: r.id})
     SET g.label = r.label, g.type = r.groupType, g.n = r.n`,
    groups
  );

  const edgesBy = (type: string) => data.edges.filter((e: any) => e.type === type);
  await batch(
    `UNWIND $rows AS r MATCH (a:Course {code: r.source}), (b:Course {code: r.target})
     MERGE (a)-[p:PREREQ_OF {grp: r.group}]->(b) SET p.kind = r.kind`,
    edgesBy("PREREQ_OF")
  );
  await batch(
    `UNWIND $rows AS r MATCH (a:Course {code: r.source}), (g:ReqGroup {id: r.target})
     MERGE (a)-[:FULFILLS]->(g)`,
    edgesBy("FULFILLS")
  );
  const partOf = edgesBy("PART_OF");
  await batch(
    `UNWIND $rows AS r MATCH (g:ReqGroup {id: r.source}), (t:ReqGroup {id: r.target})
     MERGE (g)-[:PART_OF]->(t)`,
    partOf.filter((e: any) => e.target.startsWith("rg:"))
  );
  await batch(
    `UNWIND $rows AS r MATCH (g:ReqGroup {id: r.source}), (t:Concentration {id: r.target})
     MERGE (g)-[:PART_OF]->(t)`,
    partOf.filter((e: any) => e.target.startsWith("conc:"))
  );

  const counts = await session.run("MATCH (n) RETURN labels(n)[0] AS label, count(*) AS c");
  for (const rec of counts.records) console.log(rec.get("label"), rec.get("c").toString());
} finally {
  await session.close();
  await driver.close();
}
console.log("Neo4j load complete.");
