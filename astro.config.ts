import { defineConfig, envField, fontProviders } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import vercel from "@astrojs/vercel";
import remarkToc from "remark-toc";
import remarkCollapse from "remark-collapse";
import {
  transformerNotationDiff,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from "@shikijs/transformers";
import { transformerFileName } from "./src/utils/transformers/fileName";
import { SITE } from "./src/config";
import { createClient } from "@supabase/supabase-js";

async function getSupabaseSlugs(): Promise<string[]> {
  const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn("Sitemap: Supabase env vars missing, skipping dynamic pages.");
    return [];
  }

  const client = createClient(supabaseUrl, supabaseKey);

  const allSlugs: string[] = [];
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await client
      .from("posts")
      .select("slug")
      .order("published_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error || !data || data.length === 0) break;

    for (const row of data) {
      if (row.slug) {
        allSlugs.push(`${SITE.website}${row.slug.replace(/^\/+|\/+$/g, "")}/`);
      }
    }

    if (data.length < pageSize) break;
    offset += pageSize;
  }

  console.log(`Sitemap: found ${allSlugs.length} posts from Supabase.`);
  return allSlugs;
}

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: vercel({
    isr: {
      expiration: 3600,
    },
  }),
  redirects: {
    "/fr/": "/",
    "/fr": "/",
  },
  site: SITE.website,
  integrations: [
    sitemap({
      filter: page => SITE.showArchives || !page.endsWith("/archives"),
      customPages: await getSupabaseSlugs(),
    }),
  ],
  markdown: {
    remarkPlugins: [remarkToc, [remarkCollapse, { test: "Table of contents" }]],
    shikiConfig: {
      themes: { light: "min-light", dark: "night-owl" },
      defaultColor: false,
      wrap: false,
      transformers: [
        transformerFileName({ style: "v2", hideDot: false }),
        transformerNotationHighlight(),
        transformerNotationWordHighlight(),
        transformerNotationDiff({ matchAlgorithm: "v3" }),
      ],
    },
  },
  vite: {
    // eslint-disable-next-line
    // @ts-ignore
    plugins: [tailwindcss()],
    optimizeDeps: {
      exclude: ["@resvg/resvg-js"],
    },
  },
  image: {
    responsiveStyles: true,
    layout: "constrained",
  },
  env: {
    schema: {
      PUBLIC_GOOGLE_SITE_VERIFICATION: envField.string({
        access: "public",
        context: "client",
        optional: true,
      }),
    },
  },
  experimental: {
    preserveScriptOrder: true,
    fonts: [
      {
        name: "Google Sans Code",
        cssVariable: "--font-google-sans-code",
        provider: fontProviders.google(),
        fallbacks: ["monospace"],
        weights: [300, 400, 500, 600, 700],
        styles: ["normal", "italic"],
      },
    ],
  },
});
