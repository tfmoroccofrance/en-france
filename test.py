import requests

SUPABASE_URL = "https://xkrbovjgikucfsjmtkua.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrcmJvdmpnaWt1Y2Zzam10a3VhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODY5MzU3NiwiZXhwIjoyMDk0MjY5NTc2fQ.1knpuCBCvt4GvuCSUmLzD0lhX1dgBVq6F4DCNVjWi3Y"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrcmJvdmpnaWt1Y2Zzam10a3VhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2OTM1NzYsImV4cCI6MjA5NDI2OTU3Nn0.jWOTVU0qFPBZqkbqxC1CvXUpVgyBc58p7lY5Iad8oZ0"

headers = {"apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY}
res = requests.get(SUPABASE_URL + "/rest/v1/posts?select=slug,image_url&limit=5", headers=headers)
for p in res.json():
    print(p["slug"], "|", p.get("image_url", "NO IMAGE")[:80])