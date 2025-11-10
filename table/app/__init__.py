"""
Vinylfy Turntable - Backend Audio Processing Service

This package provides the backend services for applying vinyl record
effects to digital audio files. It simulates the warm, mostalgic sound
of vinyl records including:

- Surface Noise
- Frequency Characteristics
- Mechancial Artifacts like pops
"""

__version__ = 'beta'
__author__ = 'Vinylfy by Brett Watz'

from .main import create_app

__all__ = ['create_app']