import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const VALID_CATEGORIES = new Set([
  "recettes-economiques",
  "recettes-facile",
  "repas-rapide",
  "cuisine",
]);

const apply = process.argv.includes("--apply");
const reclassify = process.argv.includes("--reclassify");
const summaryOnly = process.argv.includes("--summary");

loadEnvFile();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY."
  );
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

const { data: posts, error } = await supabase
  .from("posts")
  .select("id,title,slug,excerpt,content,category_slug")
  .order("published_at", { ascending: false });

if (error) throw error;

const changes = [];
const skipped = [];

for (const post of posts ?? []) {
  const current = normalizeCategory(post.category_slug);
  const classification = classifyPost(post);

  if (current && VALID_CATEGORIES.has(current) && !reclassify) {
    skipped.push({ slug: post.slug, category_slug: current, reason: "already valid" });
    continue;
  }

  if (
    current &&
    VALID_CATEGORIES.has(current) &&
    reclassify &&
    current === classification.category
  ) {
    skipped.push({ slug: post.slug, category_slug: current, reason: "already correct" });
    continue;
  }

  if (
    current &&
    VALID_CATEGORIES.has(current) &&
    reclassify &&
    classification.score < 3
  ) {
    skipped.push({
      slug: post.slug,
      category_slug: current,
      reason: "kept existing category; classifier confidence too low",
    });
    continue;
  }

  changes.push({
    id: post.id,
    slug: post.slug,
    from: current || null,
    to: classification.category,
    score: classification.score,
    reason: classification.reason,
  });
}

console.log(`Posts scanned: ${posts?.length ?? 0}`);
console.log(`Posts skipped: ${skipped.length}`);
console.log(`Posts to update: ${changes.length}`);
console.table(countByCategory(changes));

if (!summaryOnly) {
  console.table(changes.map(({ slug, from, to, score, reason }) => ({ slug, from, to, score, reason })));
}

if (!apply) {
  console.log("\nDry run only. Re-run with --apply to update posts.category_slug.");
  console.log("Use --reclassify only if you want to revisit already valid categories.");
  process.exit(0);
}

for (const change of changes) {
  const { error: updateError } = await supabase
    .from("posts")
    .update({ category_slug: change.to })
    .eq("id", change.id)
    .select("id");

  if (updateError) {
    console.error(`Failed to update ${change.slug}:`, updateError.message);
    process.exitCode = 1;
  } else {
    console.log(`Updated ${change.slug}: ${change.from ?? "(empty)"} -> ${change.to}`);
  }
}

function classifyPost(post) {
  const headlineText = normalizeText(
    [post.title, post.excerpt].filter(Boolean).join(" ")
  );
  const bodyText = normalizeText(post.content ?? "").slice(0, 5000);
  const text = `${headlineText} ${bodyText}`.trim();

  if (!hasRecipeIntent(headlineText)) {
    return { category: "cuisine", score: 0, reason: "fallback/general article" };
  }

  const scores = {
    "recettes-economiques": scoreText(headlineText, [
      [/\beconomiqu(?:e|es|ement)\b/g, 8],
      [/\beconomiser\b/g, 8],
      [/\beconomies?\b/g, 8],
      [/\bpas cher(?:e|es|s)?\b/g, 10],
      [/\bbon marche\b/g, 10],
      [/\bbudget\b/g, 8],
      [/\blow cost\b/g, 8],
      [/\bpetit prix\b/g, 8],
      [/\bpetit budget\b/g, 10],
      [/\bmoins de \d+\s*(?:e|eur|euros?)\b/g, 8],
      [/\bfamille\b/g, 2],
      [/\bpates?\b/g, 2],
      [/\briz\b/g, 2],
      [/\bpommes? de terre\b/g, 2],
      [/\boeufs?\b/g, 2],
      [/\blentilles?\b/g, 4],
    ]) + scoreText(bodyText, [
      [/\beconomiqu(?:e|es|ement)\b/g, 4],
      [/\beconomiser\b/g, 4],
      [/\beconomies?\b/g, 4],
      [/\bpas cher(?:e|es|s)?\b/g, 5],
      [/\bbon marche\b/g, 5],
      [/\bbudget\b/g, 4],
      [/\blow cost\b/g, 4],
      [/\bpetit prix\b/g, 4],
      [/\bmoins cher\b/g, 3],
      [/\bfamille\b/g, 1],
      [/\bpates?\b/g, 1],
      [/\briz\b/g, 1],
      [/\bpommes? de terre\b/g, 1],
      [/\boeufs?\b/g, 1],
      [/\blentilles?\b/g, 2],
    ]),
    "recettes-facile": scoreText(headlineText, [
      [/\bfacile(?:s)?\b/g, 10],
      [/\bsimple(?:s)?\b/g, 8],
      [/\binratable(?:s)?\b/g, 8],
      [/\bdebutant(?:e|es|s)?\b/g, 10],
      [/\bsans difficulte\b/g, 8],
      [/\bquelques etapes\b/g, 4],
      [/\bpreparer facilement\b/g, 8],
      [/\brapide a preparer\b/g, 5],
    ]) + scoreText(bodyText, [
      [/\bfacile(?:s)?\b/g, 5],
      [/\bsimple(?:s)?\b/g, 4],
      [/\binratable(?:s)?\b/g, 4],
      [/\bdebutant(?:e|es|s)?\b/g, 5],
      [/\bsans difficulte\b/g, 4],
      [/\bquelques etapes\b/g, 2],
      [/\bpreparer facilement\b/g, 4],
      [/\brapide a preparer\b/g, 3],
    ]),
    "repas-rapide": scoreText(headlineText, [
      [/\brapide(?:s)?\b/g, 8],
      [/\bexpress\b/g, 10],
      [/\bpret(?:e|es|s)? en (?:\d+|quelques) minutes\b/g, 10],
      [/\b\d+\s*(?:min|minutes)\b/g, 8],
      [/\b15\s*(?:min|minutes)\b/g, 12],
      [/\b20\s*(?:min|minutes)\b/g, 8],
      [/\bdiner rapide\b/g, 10],
      [/\brepas rapide\b/g, 10],
      [/\bsur le pouce\b/g, 8],
    ]) + scoreText(bodyText, [
      [/\brapide(?:s)?\b/g, 4],
      [/\bexpress\b/g, 5],
      [/\bpret(?:e|es|s)? en (?:\d+|quelques) minutes\b/g, 5],
      [/\b\d+\s*(?:min|minutes)\b/g, 4],
      [/\b15\s*(?:min|minutes)\b/g, 6],
      [/\b20\s*(?:min|minutes)\b/g, 4],
      [/\bdiner rapide\b/g, 5],
      [/\brepas rapide\b/g, 5],
      [/\bsur le pouce\b/g, 4],
    ]),
    cuisine: scoreText(headlineText, [
      [/\bcuisine\b/g, 3],
      [/\brecette(?:s)?\b/g, 3],
      [/\bplat(?:s)?\b/g, 3],
    ]) + scoreText(bodyText, [
      [/\bcuisine\b/g, 1],
      [/\brecette(?:s)?\b/g, 1],
      [/\bplat(?:s)?\b/g, 1],
    ]),
  };

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [category, score] = ranked[0];

  if (score <= 0) {
    return { category: "cuisine", score: 0, reason: "fallback" };
  }

  return { category, score, reason: `keyword score ${score}` };
}

function hasRecipeIntent(text) {
  return /\b(?:recette|recettes|repas|diner|dejeuner|petit dejeuner|dessert|gateau|cookies?|biscuit|tarte|quiche|gratin|soupe|salade|poulet|boeuf|veau|porc|saumon|poisson|crevettes?|crabe|fromage|oeufs?|pates?|riz|pommes? de terre|lentilles?|pois chiches?|courgettes?|carottes?|chocolat|cuisine|plat|tajine|couscous|loubia|air fryer|cookeo|thermomix|mijoteuse|four|sauce|curry|pancakes?|crepes?)\b/.test(
    text
  );
}

function scoreText(text, patterns) {
  return patterns.reduce((total, [pattern, weight]) => {
    const matches = text.match(pattern);
    return total + (matches?.length ?? 0) * weight;
  }, 0);
}

function normalizeCategory(value) {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}

function normalizeText(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countByCategory(rows) {
  return [...VALID_CATEGORIES].map(category_slug => ({
    category_slug,
    updates: rows.filter(row => row.to === category_slug).length,
  }));
}

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
