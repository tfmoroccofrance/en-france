import requests
import re
import time
import os
import json
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# ============================================
# CONFIG
# ============================================
SUPABASE_URL    = "https://xkrbovjgikucfsjmtkua.supabase.co"
SUPABASE_KEY    = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrcmJvdmpnaWt1Y2Zzam10a3VhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODY5MzU3NiwiZXhwIjoyMDk0MjY5NTc2fQ.1knpuCBCvt4GvuCSUmLzD0lhX1dgBVq6F4DCNVjWi3Y"
BUCKET_DISPLAY  = "En France"
BUCKET_ENCODED  = "En%20France"
PROGRESS_FILE   = "fix_progress.json"  # يحفظ التقدم تلقائياً
# ============================================

SUP_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
}

def make_session():
    session = requests.Session()
    retry = Retry(total=5, backoff_factor=3, status_forcelist=[429, 500, 502, 503, 504])
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("https://", adapter)
    return session

SESSION = make_session()

def save_progress(index):
    with open(PROGRESS_FILE, "w") as f:
        json.dump({"last_index": index}, f)

def load_progress():
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, "r") as f:
            data = json.load(f)
            return data.get("last_index", 0)
    return 0

def get_all_posts():
    res = SESSION.get(
        f"{SUPABASE_URL}/rest/v1/posts?select=id,slug,featured_image,content&limit=1000",
        headers=SUP_HEADERS, timeout=30
    )
    return res.json()

def check_image_exists(url):
    try:
        res = SESSION.head(url, timeout=10)
        return res.status_code == 200
    except:
        return False

def get_wp_url(supabase_url):
    base1 = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET_ENCODED}/"
    base2 = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET_DISPLAY}/"
    filename = supabase_url.replace(base1, "").replace(base2, "")
    parts = filename.split("-", 2)
    if len(parts) >= 3:
        year, month, rest = parts[0], parts[1], parts[2]
        if year.isdigit() and month.isdigit():
            return f"https://tfmorocco.com/wp-content/uploads/{year}/{month}/{rest}"
    return None

def download_from_wp(wp_url, retries=4):
    for attempt in range(retries):
        try:
            res = SESSION.get(wp_url, timeout=30)
            if res.status_code == 200:
                content_type = res.headers.get("Content-Type", "image/jpeg").split(";")[0]
                return res.content, content_type
        except Exception as e:
            wait = (attempt + 1) * 4
            print(f"    Retry {attempt+1}/{retries} dans {wait}s...")
            time.sleep(wait)
    return None, None

def upload_to_supabase(image_data, content_type, filename):
    upload_url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET_DISPLAY}/{filename}"
    headers = {**SUP_HEADERS, "Content-Type": content_type, "x-upsert": "true"}
    try:
        res = SESSION.post(upload_url, headers=headers, data=image_data, timeout=60)
        return res.status_code in (200, 201)
    except Exception as e:
        print(f"    ERREUR upload: {e}")
        return False

def extract_supabase_images(content):
    pattern = rf'{re.escape(SUPABASE_URL)}/storage/v1/object/public/[^\s"\'<>]+'
    return list(set(re.findall(pattern, content or "")))

def main():
    print("=" * 55)
    print("  Correction des images manquantes (avec reprise)")
    print("=" * 55 + "\n")

    posts = get_all_posts()
    total = len(posts)

    # Charger la progression
    start_index = load_progress()
    if start_index > 0:
        print(f"Reprise depuis l'article {start_index + 1}/{total}\n")
    else:
        print(f"{total} articles trouves\n")

    fixed   = 0
    missing = 0
    ok      = 0

    for i, post in enumerate(posts):
        # Sauter les articles déjà traités
        if i < start_index:
            continue

        slug           = post.get("slug", "")
        featured_image = post.get("featured_image", "") or ""
        content        = post.get("content", "") or ""

        print(f"[{i+1}/{total}] {slug}")

        all_urls = []
        if SUPABASE_URL in featured_image:
            all_urls.append(featured_image)
        all_urls.extend(extract_supabase_images(content))
        all_urls = list(set(all_urls))

        for img_url in all_urls:
            if not check_image_exists(img_url):
                print(f"  MANQUANTE: ...{img_url[-50:]}")
                wp_url = get_wp_url(img_url)
                if wp_url:
                    image_data, content_type = download_from_wp(wp_url)
                    if image_data:
                        filename = img_url.split(f"/{BUCKET_ENCODED}/")[-1].split(f"/{BUCKET_DISPLAY}/")[-1]
                        if upload_to_supabase(image_data, content_type, filename):
                            print(f"  OK reparee")
                            fixed += 1
                        else:
                            print(f"  ERREUR upload")
                            missing += 1
                    else:
                        print(f"  ERREUR download WP")
                        missing += 1
                else:
                    missing += 1
            else:
                ok += 1

        # Sauvegarder la progression après chaque article
        save_progress(i + 1)
        time.sleep(1)

    # Supprimer le fichier de progression à la fin
    if os.path.exists(PROGRESS_FILE):
        os.remove(PROGRESS_FILE)

    print("\n" + "=" * 55)
    print(f"  Images OK        : {ok}")
    print(f"  Images reparees  : {fixed}")
    print(f"  Images manquantes: {missing}")
    print("  Termine !")
    print("=" * 55)

if __name__ == "__main__":
    main()
