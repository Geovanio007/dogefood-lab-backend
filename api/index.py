"""Vercel Serverless Function Entry Point for DogeFood Lab API"""
import os
import sys

# The api folder contains the backend code
# Add api directory to path for imports
api_path = os.path.dirname(os.path.abspath(__file__))
if api_path not in sys.path:
    sys.path.insert(0, api_path)

# Import the FastAPI app
from server import app, api_router

# Include the API router
app.include_router(api_router)

# Vercel expects a 'handler' or 'app' export
handler = app
