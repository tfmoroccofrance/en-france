import rss from "@astrojs/rss";
import { SITE } from "@/config";
import { fetchLatestPosts } from "@/lib/posts";

export async function GET() {
  const { data: posts } = await fetchLatestPosts(50);

  return rss({
    title: SITE.title,
    description: SITE.desc,
    site: SITE.website,
    items: posts.map(post => ({
      link: post.url,
      title: post.title,
      description: post.metaDescription,
      pubDate: post.publishedAt,
    })),
  });
}
