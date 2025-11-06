# ===========================
# Utilties / Help Functions
# ===========================

import os
import tempfile
from pathlib import Path
from werkzeug.utils import secure_filename
from typing import Optional, Tuple
import logging

logger = logging.getLogger(__name__)

# =================================
# Check files for valid extensions
# =================================

def allowed_file(filename: str, allowed_extensions: set) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions

def get_file_extension(filename: str) -> str:
    return filename.rsplit('.', 1)[1].lower() if '.' in filename else ''

# ===================================================
# Create temporary file for processing
# Args -> suffix = Optional suffix for the temp file
# Returns -> Tuple of file desciptor and file path
# ===================================================

def create_temp_file(suffix: str = '') -> Tuple[int, str]:
    fd, path = tempfile.mkstemp(suffix=suffix)
    return fd, path

# ================================================
# Temp file cleanup safely
# ================================================
def cleanup_temp_file(filepath: str) -> None:
    try:
        if filepath and os.path.exists(filepath):
            os.unlink(filepath)
            logger.debug(f"Cleaned up temporary file: {filepath}")
    except Exception as e:
        logger.warning(f"Failed to cleanup temp file {filepath} with error: {e}")

# =========================================
# Validate audio processing settings
# Args -> settings = Dictionary of settings
# Returns -> Tuple of bool (is_valid) and error message if any as string
# =========================================
def validate_audio_settings(settings: dict) -> Tuple[bool, Optional[str]]:
    # Validate noise intensity
    noise_intensity = settings.get('noise_intensity', 0.02)
    if not 0 <= noise_intensity <= 0.1:
        return False, "Noise Intensity must be between 0 and 0.1"
    
    # Validate wow/flutter intensity
    wow_flutter_intensity = settings.get('wow_flutter_intensity', 0.001)
    if not 0 <= wow_flutter_intensity <= 0.01:
        return False, "Wow / Flutter Intensity must be between 0 and 0.01"
    
    # Validate distortion amount
    distortion_amount = settings.get('distortion_amount', 0.15)
    if not 0 <= distortion_amount <= 1.0:
        return False, "Distoriton Amount must be between 0 and 1"
    
    # Validate stereo width
    stereo_width = settings.get('stereo_width', 0.7)
    if not 0 <= stereo_width <= 1.0:
        return False, "Stereo Width must be between 0 and 1"
    
    return True, None

# ===============================
# Format file size into human readable
# ===============================
def format_file_size(size_bytes: int) -> str:
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.2f} TB"

# ====================================
# Get audio file info
# Args -> filepth = path to audio file
# Returns -> Dictionary containing file info
# ====================================
def get_audio_info(filepath: str) -> dict:
    try:
        file_size = os.path.getsize(filepath)
        file_ext = get_file_extension(filepath)

        return {
            'size': file_size,
            'size_formatted': format_file_size(file_size),
            'extension': file_ext,
            'path': filepath
        }
    except Exception as e:
        logger.error(f"Error getting audio file information from {filepath} with error of: {e}")
        return {}
    
def merge_settings(preset_settings: dict, custom_settings: dict) -> dict:
    merged = preset_settings.copy()

    # Update with custom settings
    for key, value in custom_settings.items():
        if value is not None:
            # Convert string bools to actual bools
            if isinstance(value, str) and value.lower() in ('true', 'false'):
                merged[key] = value.lower() == 'true'
            else:
                merged[key] = value

    return merged

def sanitize_filename(filename: str, max_length):
    safe_name = secure_filename(filename)

    # ensure filename not too long
    if len(safe_name) > max_length:
        name, ext = os.path.splitext(safe_name)
        name = name[:max_length - len(ext)]
        safe_name = name + ext
    
    return safe_name

def parse_boolean(value) -> bool:
    """ Parse string values like true, false, 1, 0 to actual booleans """
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.lower() in ('true', '1','yes', 'no')
    return bool(value)