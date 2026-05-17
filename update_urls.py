import requests
import re

SUPABASE_URL = "https://xkrbovjgikucfsjmtkua.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrcmJvdmpnaWt1Y2Zzam10a3VhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODY5MzU3NiwiZXhwIjoyMDk0MjY5NTc2fQ.1knpuCBCvt4GvuCSUmLzD0lhX1dgBVq6F4DCNVjWi3Y"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrcmJvdmpnaWt1Y2Zzam10a3VhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2OTM1NzYsImV4cCI6MjA5NDI2OTU3Nn0.jWOTVU0qFPBZqkbqxC1CvXUpVgyBc58p7lY5Iad8oZ0"
BUCKET_NAME  = "En France"

SUP_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
}

OLD_BASE = "https://tfmorocco.com/wp-content/uploads"
NEW_BASE = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET_NAME}"

def wp_to_supabase_url(wp_url):
    if not wp_url or OLD_BASE not in wp_url:
        return None
    relative = wp_url.replace(OLD_BASE + "/", "")
    filename = relative.replace("/", "-")
    return f"{NEW_BASE}/{filename}"

def main():
    print("=" * 55)
    print("  Mise a jour featured_image + content")
    print("=" * 55)

    res = requests.get(
        f"{SUPABASE_URL}/rest/v1/posts?select=id,slug,featured_image,image_url,content&limit=1000",
        headers=SUP_HEADERS,
        timeout=30
    )
    posts = res.json()
    print(f"\n{len(posts)} articles trouves\n")

    updated = 0
    skipped = 0

    for i, post in enumerate(posts, 1):
        post_id        = post["id"]
        slug           = post.get("slug", "")
        featured_image = post.get("featured_image", "") or ""
        image_url      = post.get("image_url", "") or ""
        content        = post.get("content", "") or ""

        print(f"[{i}/{len(posts)}] {slug}")

        patch = {}

        # Update featured_image
        if OLD_BASE in featured_image:
            new_url = wp_to_supabase_url(featured_image)
            if new_url:
                patch["featured_image"] = new_url
                print(f"  >> featured_image mis a jour")

        # Update image_url
        if OLD_BASE in image_url:
            new_url = wp_to_supabase_url(image_url)
            if new_url:
                patch["image_url"] = new_url
                print(f"  >> image_url mis a jour")

        # Update content
        if OLD_BASE in content:
            wp_urls = list(set(re.findall(
                r'https://tfmorocco\.com/wp-content/uploads/[^\s"\'<>]+',
                content
            )))
            new_content = content
            for wp_url in wp_urls:
                new_url = wp_to_supabase_url(wp_url)
                if new_url:
                    new_content = new_content.replace(wp_url, new_url)
            if new_content != content:
                patch["content"] = new_content
                print(f"  >> {len(wp_urls)} URLs dans content mises a jour")

        if patch:
            r = requests.patch(
                f"{SUPABASE_URL}/rest/v1/posts?id=eq.{post_id}",
                headers={**SUP_HEADERS, "Content-Type": "application/json", "Prefer": "return=minimal"},
                json=patch,
                timeout=30
            )
            if r.status_code in (200, 204):
                print(f"  OK")
                updated += 1
            else:
                print(f"  ERREUR {r.status_code}: {r.text[:100]}")
        else:
            print(f"  -- pas de WP URLs")
            skipped += 1

    print("\n" + "=" * 55)
    print(f"  Articles mis a jour : {updated}")
    print(f"  Articles ignores    : {skipped}")
    print("  Termine !")
    print("=" * 55)

if __name__ == "__main__":
    main()
