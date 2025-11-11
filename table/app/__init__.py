"""
Vinylfy Turntable - Backend Audio Processing Service

This package provides the backend services for applying vinyl record
effects to digital audio files. It simulates the warm, mostalgic sound
of vinyl records including:

- Surface Noise
- Frequency Characteristics
- Mechancial Artifacts like pops
"""

import json
import os

# Load version from centralized version.json
_version_file = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'version.json')
try:
    with open(_version_file, 'r') as f:
        _version_data = json.load(f)
        __version__ = _version_data['version']
except Exception as e:
    # Fallback version if file doesn't exist
    __version__ = 'v1.0.0 Beta 2.2.2'
    print(f"Warning: Could not load version from version.json: {e}")

__author__ = 'Vinylfy by Brett Watz'

from .main import create_app

__all__ = ['create_app']