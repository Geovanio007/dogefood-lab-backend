"""Vercel Serverless Function Entry Point for DogeFood Lab API"""
import os
import sys

# CRITICAL: Add api directory to Python path BEFORE any imports
api_path = os.path.dirname(os.path.abspath(__file__))
if api_path not in sys.path:
    sys.path.insert(0, api_path)

# Set up logging
import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    # Import Mangum for ASGI -> Lambda/Vercel adapter
    from mangum import Mangum
    
    # Import the FastAPI app (router is already included in server.py)
    from server import app
    
    logger.info("✅ DogeFood Lab API loaded successfully")
    
except Exception as e:
    logger.error(f"❌ Failed to import server: {str(e)}")
    import traceback
    traceback.print_exc()
    raise

# Vercel/Lambda expects a handler export - wrap FastAPI with Mangum
handler = Mangum(app, lifespan="off")
