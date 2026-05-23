import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

loadEnvFile();

const SUPABASE_URL =
  process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL) throw new Error("Missing env var: SUPABASE_URL");
if (!SUPABASE_KEY) throw new Error("Missing env var: SUPABASE_ANON_KEY");

const R2_PUBLIC_URL = "https://images.tfmorocco.com";

// All old URL prefixes to replace -> new prefix
const REPLACEMENTS = [
  [
    `${SUPABASE_URL}/storage/v1/object/public/En%20France/`,
    `${R2_PUBLIC_URL}/`,
  ],
  [
    `${SUPABASE_URL}/storage/v1/object/public/En France/`,
    `${R2_PUBLIC_URL}/`,
  ],
  [
    `${SUPABASE_URL}/storage/v1/object/public/Recettes/`,
    `${R2_PUBLIC_URL}/`,
  ],
];

function replaceAll(text) {
  if (!text) return text;
  let result = text;
  for (const [oldPrefix, newPrefix] of REPLACEMENTS) {
    result = result.split(oldPrefix).join(newPrefix);
  }
  return result;
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

console.log("Fetching posts with old Supabase image URLs...");

const { data: posts, error: fetchErr } = await supabase
  .from("posts")
  .select("id, slug, featured_image, content")
  .ilike("content", `%${new URL(SUPABASE_URL).hostname}%`);

if (fetchErr) throw new Error(`Failed to fetch posts: ${fetchErr.message}`);

console.log(`Found ${posts?.length ?? 0} post(s) with old URLs.\n`);

let fixed = 0;
let errors = 0;

for (const post of posts ?? []) {
  const newContent = replaceAll(post.content);
  const newFeaturedImage = replaceAll(post.featured_image);

  const contentChanged = newContent !== post.content;
  const featuredChanged = newFeaturedImage !== post.featured_image;

  if (!contentChanged && !featuredChanged) {
    console.log(`  skip: ${post.slug} (no matching URLs found in fields)`);
    continue;
  }

  const updates = {};
  if (contentChanged) updates.content = newContent;
  if (featuredChanged) updates.featured_image = newFeaturedImage;

  const { error: updateErr } = await supabase
    .from("posts")
    .update(updates)
    .eq("id", post.id);

  if (updateErr) {
    console.error(`  ❌ ${post.slug}: ${updateErr.message}`);
    errors++;
  } else {
    const fields = [contentChanged && "content", featuredChanged && "featured_image"]
      .filter(Boolean)
      .join(", ");
    console.log(`  ✅ ${post.slug} (fixed: ${fields})`);
    fixed++;
  }
}

console.log(`\n--- Done ---`);
console.log(`Posts fixed : ${fixed}`);
if (errors) console.log(`Errors      : ${errors}`);

// --- Helper ---
function loadEnvFile() {
  if (!fs.existsSync(".env")) return;
  const lines = fs.readFileSync(".env", "utf8").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}
