"""Vercel Serverless Function Entry Point for DogeFood Lab API"""
import sys
import os

# Add the backend directory to Python path for imports
backend_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend')
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

# Import the FastAPI app from backend/server.py
from server import app, api_router

# Include the API router in the app
app.include_router(api_router)

# Export the app for Vercel
handler = app
