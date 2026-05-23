import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

loadEnvFile();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_BUCKET = process.env.R2_BUCKET;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");

for (const [key, val] of Object.entries({
  SUPABASE_URL,
  SUPABASE_KEY,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_ENDPOINT,
  R2_BUCKET,
  R2_PUBLIC_URL,
})) {
  if (!val) throw new Error(`Missing env var: ${key}`);
}

const STORAGE_BUCKET = "En France";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

const r2 = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// --- List all files recursively in the Supabase bucket ---
async function listAllFiles(prefix = "") {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .list(prefix, { limit: 1000, offset: 0 });

  if (error) throw new Error(`list("${prefix}"): ${error.message}`);

  const files = [];
  for (const item of data ?? []) {
    const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id === null) {
      // folder — recurse
      files.push(...(await listAllFiles(itemPath)));
    } else {
      files.push(itemPath);
    }
  }
  return files;
}

function getMimeType(filename) {
  const ext = filename.split(".").pop()?.toLowerCase();
  return (
    {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
      avif: "image/avif",
    }[ext] ?? "application/octet-stream"
  );
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// --- Main ---
console.log(`Listing files in Supabase bucket "${STORAGE_BUCKET}"...`);
const allFiles = await listAllFiles();
console.log(`Found ${allFiles.length} file(s).\n`);

let migrated = 0;
let skipped = 0;
let errors = 0;

for (const filePath of allFiles) {
  console.log(`Uploading: ${filePath}`);
  try {
    const { data: blob, error: dlErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(filePath);
    if (dlErr) throw new Error(dlErr.message);

    const buffer = Buffer.from(await blob.arrayBuffer());

    await r2.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: filePath,
        Body: buffer,
        ContentType: getMimeType(filePath),
      })
    );

    const r2Url = `${R2_PUBLIC_URL}/${filePath}`;
    console.log(`✅ Done: ${filePath} -> ${r2Url}`);
    migrated++;
  } catch (err) {
    console.error(`❌ Error migrating "${filePath}": ${err.message}`);
    errors++;
  }
}

// --- Update posts table ---
console.log("\nScanning posts for Supabase image URLs...");

// Match both space and %20 variants of the bucket name in stored URLs
const supabaseStorageBase = `${SUPABASE_URL}/storage/v1/object/public/`;
const urlPattern = new RegExp(
  `${escapeRegex(supabaseStorageBase)}(?:${escapeRegex("En%20France")}|${escapeRegex("En France")})/`,
  "g"
);
const r2Base = `${R2_PUBLIC_URL}/`;

const { data: posts, error: postsErr } = await supabase
  .from("posts")
  .select("id, slug, featured_image, content");

if (postsErr) throw new Error(`Failed to fetch posts: ${postsErr.message}`);

let updatedPosts = 0;

for (const post of posts ?? []) {
  const newFeaturedImage = post.featured_image?.replace(urlPattern, r2Base) ?? post.featured_image;
  const newContent = post.content?.replace(urlPattern, r2Base) ?? post.content;

  const featuredChanged = newFeaturedImage !== post.featured_image;
  const contentChanged = newContent !== post.content;

  if (!featuredChanged && !contentChanged) continue;

  const updates = {};
  if (featuredChanged) updates.featured_image = newFeaturedImage;
  if (contentChanged) updates.content = newContent;

  const { error: updateErr } = await supabase
    .from("posts")
    .update(updates)
    .eq("id", post.id);

  if (updateErr) {
    console.error(`❌ Failed to update post "${post.slug}": ${updateErr.message}`);
    errors++;
  } else {
    const changed = [
      featuredChanged && "featured_image",
      contentChanged && "content",
    ]
      .filter(Boolean)
      .join(", ");
    console.log(`✅ Post updated: ${post.slug} (${changed})`);
    updatedPosts++;
  }
}

console.log("\n--- Migration complete ---");
console.log(`Files migrated : ${migrated} / ${allFiles.length}`);
if (skipped) console.log(`Files skipped  : ${skipped}`);
if (errors) console.log(`Errors         : ${errors}`);
console.log(`Posts updated  : ${updatedPosts}`);

// --- Helpers ---
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
