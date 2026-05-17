import requests
import os
import time
import re

# ============================================
# CONFIG — املأ هذه البيانات فقط
# ============================================
UPLOADS_FOLDER = r"C:\Users\Mebrouk Hassan\Desktop\2026"

SUPABASE_URL = "https://xkrbovjgikucfsjmtkua.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrcmJvdmpnaWt1Y2Zzam10a3VhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODY5MzU3NiwiZXhwIjoyMDk0MjY5NTc2fQ.1knpuCBCvt4GvuCSUmLzD0lhX1dgBVq6F4DCNVjWi3Y"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrcmJvdmpnaWt1Y2Zzam10a3VhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2OTM1NzYsImV4cCI6MjA5NDI2OTU3Nn0.jWOTVU0qFPBZqkbqxC1CvXUpVgyBc58p7lY5Iad8oZ0"
BUCKET_NAME  = "En France"
# ============================================

SUP_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
}

SUPPORTED = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"}

MIME_TYPES = {
    ".jpg":  "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png":  "image/png",
    ".webp": "image/webp",
    ".gif":  "image/gif",
    ".avif": "image/avif",
}

def is_thumbnail(name):
    return bool(re.search(r'-\d+x\d+\.(jpg|jpeg|png|webp|gif|avif)$', name, re.I))

def collect_images(root):
    """جمع كل الصور باستخدام scandir لتجنب مشكلة المسارات الطويلة"""
    images = []
    try:
        with os.scandir(root) as it:
            for entry in it:
                if entry.is_dir(follow_symlinks=False):
                    images.extend(collect_images(entry.path))
                elif entry.is_file():
                    ext = os.path.splitext(entry.name)[1].lower()
                    if ext in SUPPORTED and not is_thumbnail(entry.name):
                        images.append(entry.path)
    except Exception as e:
        print(f"  ERREUR scandir {root}: {e}")
    return images

def upload_image(local_path, filename):
    ext = os.path.splitext(local_path)[1].lower()
    content_type = MIME_TYPES.get(ext, "image/jpeg")
    upload_url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET_NAME}/{filename}"
    headers = {**SUP_HEADERS, "Content-Type": content_type, "x-upsert": "true"}
    try:
        with open(local_path, "rb") as f:
            data = f.read()
        res = requests.post(upload_url, headers=headers, data=data, timeout=60)
        return res.status_code in (200, 201)
    except Exception as e:
        print(f"    ERREUR: {e}")
        return False

def main():
    print("=" * 55)
    print("  Upload images vers Supabase Storage")
    print("=" * 55 + "\n")

    print("Recherche des images...")
    all_images = collect_images(UPLOADS_FOLDER)
    print(f"Total images trouvees: {len(all_images)}\n")

    if len(all_images) == 0:
        print("Aucune image trouvee!")
        return

    success = 0
    failed  = 0

    for i, img_path in enumerate(all_images, 1):
        rel = os.path.relpath(img_path, UPLOADS_FOLDER)
        filename = rel.replace("\\", "-").replace("/", "-")

        print(f"[{i}/{len(all_images)}] {filename[:70]}")

        if upload_image(img_path, filename):
            print(f"  OK")
            success += 1
        else:
            print(f"  ERREUR")
            failed += 1

        if i % 50 == 0:
            print(f"\n  Pause 2s...\n")
            time.sleep(2)
        else:
            time.sleep(0.05)

    print("\n" + "=" * 55)
    print(f"  Succes  : {success}")
    print(f"  Echecs  : {failed}")
    print("  Upload termine !")
    print("=" * 55)

if __name__ == "__main__":
    main()
