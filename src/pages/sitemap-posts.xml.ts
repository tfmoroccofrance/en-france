import type { APIRoute } from "astro";
import { fetchAllPosts } from "@/lib/posts";
import { SITE } from "@/config";

export const GET: APIRoute = async () => {
  const { data: posts } = await fetchAllPosts();

  const siteUrl = SITE.website.replace(/\/$/, "");

  const urls = posts
    .map(post => {
      const loc = `${siteUrl}/${post.slug}/`;
      const lastmod = post.publishedAt.toISOString().split("T")[0];
      return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
