from supabase import create_client, Client
from config.settings import SUPABASE_KEY,SUPABASE_URL

supabase : Client = create_client(
    SUPABASE_URL,SUPABASE_KEY
)

