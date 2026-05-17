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

# الرابط الخاطئ (مسافة) → الرابط الصحيح (%20)
OLD_URL = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET_NAME}/"
NEW_URL = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET_NAME.replace(' ', '%20')}/"

def main():
    print("=" * 55)
    print("  Correction encodage URLs (espace → %20)")
    print("=" * 55)
    print(f"\nAncien: {OLD_URL}")
    print(f"Nouveau: {NEW_URL}\n")

    res = requests.get(
        f"{SUPABASE_URL}/rest/v1/posts?select=id,slug,featured_image,image_url,content&limit=1000",
        headers=SUP_HEADERS,
        timeout=30
    )
    posts = res.json()
    print(f"{len(posts)} articles trouves\n")

    updated = 0
    skipped = 0

    for i, post in enumerate(posts, 1):
        post_id        = post["id"]
        slug           = post.get("slug", "")
        featured_image = post.get("featured_image", "") or ""
        image_url      = post.get("image_url", "") or ""
        content        = post.get("content", "") or ""

        patch = {}

        if OLD_URL in featured_image:
            patch["featured_image"] = featured_image.replace(OLD_URL, NEW_URL)

        if OLD_URL in image_url:
            patch["image_url"] = image_url.replace(OLD_URL, NEW_URL)

        if OLD_URL in content:
            patch["content"] = content.replace(OLD_URL, NEW_URL)

        if patch:
            r = requests.patch(
                f"{SUPABASE_URL}/rest/v1/posts?id=eq.{post_id}",
                headers={**SUP_HEADERS, "Content-Type": "application/json", "Prefer": "return=minimal"},
                json=patch,
                timeout=30
            )
            if r.status_code in (200, 204):
                print(f"[{i}] OK — {slug}")
                updated += 1
            else:
                print(f"[{i}] ERREUR {r.status_code} — {slug}")
        else:
            skipped += 1

    print("\n" + "=" * 55)
    print(f"  Articles corriges : {updated}")
    print(f"  Articles ignores  : {skipped}")
    print("  Termine !")
    print("=" * 55)

if __name__ == "__main__":
    main()
