"""Vercel Serverless Function Entry Point for DogeFood Lab API"""
import os
import sys

# CRITICAL: Add api directory to Python path BEFORE any imports
# This ensures that relative imports like 'from services.xxx' work correctly
api_path = os.path.dirname(os.path.abspath(__file__))
if api_path not in sys.path:
    sys.path.insert(0, api_path)

# Also add the parent path for any root-level imports
root_path = os.path.dirname(api_path)
if root_path not in sys.path:
    sys.path.insert(0, root_path)

# Set up logging
import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    # Now import the FastAPI app
    from server import app, api_router
    
    # Include the API router
    app.include_router(api_router)
    
    logger.info("✅ DogeFood Lab API loaded successfully")
    
except Exception as e:
    logger.error(f"❌ Failed to import server: {str(e)}")
    import traceback
    traceback.print_exc()
    raise

# Vercel expects a 'handler' or 'app' export
handler = app
