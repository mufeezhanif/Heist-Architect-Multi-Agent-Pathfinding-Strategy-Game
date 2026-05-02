import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

# Import and expose the FastAPI app
from main import app

# Vercel will call the handler on incoming requests

