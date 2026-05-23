import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_KEY =
  process.env.PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const SITE_URL = process.env.SITE_URL || "https://en-france.com/";

const OUTPUT = new URL("../sitemap-urls.json", import.meta.url);

if (!SUPABASE_URL || !SUPABASE_URL.startsWith("http")) {
  console.warn("generate-sitemap-urls: missing/invalid SUPABASE_URL — writing empty list.");
  fs.writeFileSync(OUTPUT, "[]", "utf-8");
  process.exit(0);
}

if (!SUPABASE_KEY) {
  console.warn("generate-sitemap-urls: missing SUPABASE_ANON_KEY — writing empty list.");
  fs.writeFileSync(OUTPUT, "[]", "utf-8");
  process.exit(0);
}

const client = createClient(SUPABASE_URL, SUPABASE_KEY);

const allSlugs = [];
const pageSize = 1000;
let offset = 0;

while (true) {
  const { data, error } = await client
    .from("posts")
    .select("slug")
    .order("published_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    console.error("generate-sitemap-urls: Supabase error:", error.message);
    break;
  }
  if (!data || data.length === 0) break;

  for (const row of data) {
    if (row.slug) {
      allSlugs.push(`${SITE_URL}${row.slug.replace(/^\/+|\/+$/g, "")}/`);
    }
  }

  if (data.length < pageSize) break;
  offset += pageSize;
}

fs.writeFileSync(OUTPUT, JSON.stringify(allSlugs, null, 2), "utf-8");
console.log(`generate-sitemap-urls: wrote ${allSlugs.length} URLs to sitemap-urls.json`);
