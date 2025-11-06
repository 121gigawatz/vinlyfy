# =========================
# Configuration Logic
# =========================

import os
from pathlib import Path

class Config:
    """Base config"""

    # Flask settings
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'vinylfy-secret-key-change-me'
    DEBUG = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    MAX_FILE_SIZE = int(os.environ.get('MAX_UPLOAD_MB', '25'))
    PROCESSED_FILES_TTL_HOURS = int(os.environ.get('FILE_TTL_HOURS', '1'))

    # File Upload Settings
    MAX_CONTENT_LENGTH = MAX_FILE_SIZE * 1024 * 1024 # Default 25MB
    UPLOAD_FOLDER = Path('/tmp/vinylfy/uploads')
    PROCESSED_FILES_DIR = Path('/tmp/vinyfly/processed')
    PROCESSED_FILES_TTL_HOURS = 1
    ALLOWED_EXTENSIONS = {'wav', 'mp3', 'flac', 'ogg', 'm4a', 'aac'}

    # Audio Processing Settings
    DEFAULT_SAMPLE_RATE = 44100
    OUTPUT_FORMAT = 'wav'
    OUTPUT_SAMPLE_WIDTH = 2 # 16-bit audio 

    # CORS SETTINGS
    CORS_ORIGINS =  os.eviron.get('CORS_ORIGINS', '*').split(',')

    # Vinyl Effect Presets
    PRESETS = {
        # The A's recommended settings
        'AJW Recommended': {
            'frequency_response': True,
            'surface_noise': True,
            'noise_intensity': 0.02,
            'wow_flutter': True,
            'wow_flutter_intensity': 0.001,
            'harmonic_distortion': True,
            'distortion_amount': 0.15,
            'stereo_reduction': True,
            'stereo_width': 0.7,
        },
        'light': {
            'frequency_response': True,
            'surface_noise': True,
            'noise_intensity': 0.01,
            'wow_flutter': True,
            'wow_flutter_intensity': 0.0005,
            'harmonic_distortion': True,
            'distortion_amount': 0.1,
            'stereo_reduction': True,
            'stereo_width': 0.85,
        },
        'medium': {
            'frequency_response': True,
            'surface_noise': True,
            'noise_intensity': 0.02,
            'wow_flutter': True,
            'wow_flutter_intensity': 0.001,
            'harmonic_distortion': True,
            'distortion_amount': 0.15,
            'stereo_reduction': True,
            'stereo_width': 0.75,
        },
        'heavy': {
            'frequency_response': True,
            'surface_noise': True,
            'noise_intensity': 0.04,
            'wow_flutter': True,
            'wow_flutter_intensity': 0.002,
            'harmonic_distortion': True,
            'distortion_amount': 0.2,
            'stereo_reduction': True,
            'stereo_width': 0.65,
        },
        'vintage': {
            'frequency_response': True,
            'surface_noise': True,
            'noise_intensity': 0.05,
            'wow_flutter': True,
            'wow_flutter_intensity': 0.003,
            'harmonic_distortion': True,
            'distortion_amount': 0.25,
            'stereo_reduction': True,
            'stereo_width': 0.5,
        },
        'custom': {
            # Custom presets - all values come from user through web interface
            # This is template to show all presets
            'frequency_response': True,
            'surface_noise': True,
            'noise_intensity': 0.02,
            'wow_flutter': True,
            'wow_flutter_intensity': 0.001,
            'harmonic_distortion': True,
            'distortion_amount': 0.15,
            'stereo_reduction': True,
            'stereo_width': 0.7,
        },
    }

    # Default settings for audio processing
    DEFAULT_SETTINGS = {
        'frequency_response': True,
            'surface_noise': True,
            'noise_intensity': 0.02,
            'wow_flutter': True,
            'wow_flutter_intensity': 0.001,
            'harmonic_distortion': True,
            'distortion_amount': 0.15,
            'stereo_reduction': True,
            'stereo_width': 0.7,
    }

    @staticmethod
    def init_app(app):
        """Initialize app config"""
        Config.UPLOAD_FOLDER.mkdir(parents=True, exist_OK=True)
        Config.PROCESSED_FILES_DIR.mkdir(parents=True, exist_OK=True)

class DevelopmentConfig(Config):
    """Development config"""
    DEBUG = True
    TESTING = False

class ProductionConfig(Config):
    """Production Config"""
    DEBUG = False
    TESTING = False

class TestingConfig(Config):
    """Testing Config"""
    DEBUG = True
    TESTING = True

# Configuration directory
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}
