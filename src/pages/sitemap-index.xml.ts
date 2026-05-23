import type { APIRoute } from "astro";
import { SITE } from "@/config";

export const GET: APIRoute = () => {
  const siteUrl = SITE.website.replace(/\/$/, "");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${siteUrl}/sitemap-0.xml</loc>
  </sitemap>
  <sitemap>
    <loc>${siteUrl}/sitemap-posts.xml</loc>
  </sitemap>
</sitemapindex>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
