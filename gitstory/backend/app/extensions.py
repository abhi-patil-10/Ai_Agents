"""
Flask extensions initialised here so they can be imported
from a single location without creating circular imports.
"""
from flask_cors import CORS

cors = CORS()
