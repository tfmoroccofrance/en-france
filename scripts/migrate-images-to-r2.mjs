import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

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

const BUCKETS = ["En France", "Recettes"];

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

// --- List all files recursively in a Supabase bucket ---
async function listAllFiles(bucket, prefix = "") {
  const files = [];
  const limit = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit, offset });

    if (error) throw new Error(`list("${prefix}", offset=${offset}): ${error.message}`);

    for (const item of data ?? []) {
      const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) {
        // folder — recurse
        files.push(...(await listAllFiles(bucket, itemPath)));
      } else {
        files.push(itemPath);
      }
    }

    if (!data || data.length < limit) break;
    offset += limit;
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
let migrated = 0;
let skipped = 0;
let errors = 0;
let totalFiles = 0;

for (const bucket of BUCKETS) {
  console.log(`\nListing files in Supabase bucket "${bucket}"...`);
  let allFiles;
  try {
    allFiles = await listAllFiles(bucket);
  } catch (err) {
    console.warn(`  ⚠️  Bucket "${bucket}" skipped: ${err.message}`);
    continue;
  }
  console.log(`Found ${allFiles.length} file(s).`);
  totalFiles += allFiles.length;

  for (const filePath of allFiles) {
    try {
      // Skip files already present in R2
      try {
        await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: filePath }));
        console.log(`  ⏭️  Already in R2: ${filePath}`);
        skipped++;
        continue;
      } catch (e) {
        if (e.$metadata?.httpStatusCode !== 404) throw e;
      }

      console.log(`  Uploading: ${filePath}`);

      // createSignedUrl returns a properly URL-encoded link, avoiding fetch
      // errors on filenames that contain spaces or other special characters.
      const { data: signedData, error: signedErr } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, 300);
      if (signedErr) throw new Error(`createSignedUrl: ${signedErr.message}`);

      const response = await fetch(signedData.signedUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status} downloading ${filePath}`);
      const buffer = Buffer.from(await response.arrayBuffer());

      await r2.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: filePath,
          Body: buffer,
          ContentType: getMimeType(filePath),
        })
      );

      console.log(`  ✅ Done: ${filePath}`);
      migrated++;
    } catch (err) {
      console.error(`  ❌ Error migrating "${filePath}": ${err.message}`);
      errors++;
    }
  }
}

// --- Update posts table ---
console.log("\nScanning posts for Supabase image URLs...");

// Match both space and %20 variants of the bucket name in stored URLs
const supabaseStorageBase = `${SUPABASE_URL}/storage/v1/object/public/`;
const urlPattern = new RegExp(
  `${escapeRegex(supabaseStorageBase)}(?:${escapeRegex("En%20France")}|${escapeRegex("En France")}|${escapeRegex("Recettes")})/`,
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
console.log(`Files migrated : ${migrated} / ${totalFiles}`);
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
