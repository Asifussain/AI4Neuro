"""
Supabase client setup and management.
"""

from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

# Global client instance
_supabase_client: Client = None


def get_supabase_client() -> Client:
    """
    Get or create a Supabase client instance.
    Uses service role key for full database access.

    Returns:
        Supabase client instance
    """
    global _supabase_client

    if _supabase_client is None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
            raise ValueError(
                "Supabase credentials not configured. "
                "Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env"
            )

        _supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    return _supabase_client


def reset_client():
    """Reset the global client (useful for testing)."""
    global _supabase_client
    _supabase_client = None
