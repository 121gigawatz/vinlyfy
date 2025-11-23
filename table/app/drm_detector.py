# ===========================
# DRM Detection Utilities
# ===========================

import os
import logging
from pathlib import Path
from typing import Tuple, Optional

logger = logging.getLogger(__name__)

# Try to import optional DRM detection libraries
try:
    from mutagen.mp4 import MP4
    MUTAGEN_AVAILABLE = True
except ImportError:
    MUTAGEN_AVAILABLE = False
    logger.warning("mutagen not available - M4P/M4A DRM detection will be limited")

try:
    from wmainfo import WmaInfo
    WMAINFO_AVAILABLE = True
except ImportError:
    WMAINFO_AVAILABLE = False
    logger.warning("wmainfo-py not available - WMA DRM detection disabled")


class DRMProtectedError(Exception):
    """Raised when attempting to process DRM-protected audio"""
    pass


def quick_drm_check(filepath: str) -> Tuple[bool, Optional[str]]:
    """
    Quick metadata-based DRM detection.
    
    Checks for common DRM indicators without decoding the entire file.
    
    Args:
        filepath: Path to the audio file
    
    Returns:
        Tuple of (has_drm: bool, drm_type: Optional[str])
        - has_drm: True if DRM is detected
        - drm_type: Description of DRM type if detected (e.g., "FairPlay", "Windows Media DRM")
    """
    try:
        file_ext = Path(filepath).suffix.lower()
        
        # Check 1: File extension - .m4p is always DRM-protected (FairPlay)
        if file_ext == '.m4p':
            logger.info(f"DRM detected: .m4p extension (FairPlay)")
            return True, "FairPlay (Apple Music)"
        
        # Check 2: M4A files - inspect atoms for DRM indicators
        if file_ext in ['.m4a', '.m4b'] and MUTAGEN_AVAILABLE:
            try:
                audio = MP4(filepath)
                
                # Check for protection atoms
                # FairPlay DRM uses 'sinf' (Sample Information) atom
                # and other encryption indicators
                if hasattr(audio, 'tags') and audio.tags:
                    # Check for common DRM-related atoms
                    drm_atoms = ['sinf', 'schi', 'user', 'name']
                    
                    # Look for encryption indicators in the file structure
                    # MP4 files with DRM often have specific atom structures
                    for key in audio.tags.keys():
                        if 'drm' in str(key).lower() or 'encrypt' in str(key).lower():
                            logger.info(f"DRM detected in M4A: encryption metadata found")
                            return True, "FairPlay (Apple Music)"
                
                # Check file info for encryption
                if hasattr(audio.info, 'encrypted') and audio.info.encrypted:
                    logger.info(f"DRM detected in M4A: file marked as encrypted")
                    return True, "FairPlay (Apple Music)"
                    
            except Exception as e:
                logger.debug(f"Could not parse M4A metadata: {e}")
                # If we can't parse it, it might be encrypted, but we'll let deep check handle it
        
        # Check 3: WMA files - use wmainfo-py
        if file_ext == '.wma' and WMAINFO_AVAILABLE:
            try:
                wma = WmaInfo(filepath)
                if wma.has_drm():
                    logger.info(f"DRM detected: WMA file with DRM protection")
                    return True, "Windows Media DRM"
            except Exception as e:
                logger.debug(f"Could not check WMA DRM: {e}")
        
        # No DRM detected in quick check
        return False, None
    
    except Exception as e:
        logger.error(f"Error during quick DRM check: {e}")
        # If quick check fails, return False and let deep check handle it
        return False, None


def deep_drm_check(filepath: str, error_message: str = "") -> Tuple[bool, Optional[str]]:
    """
    Deep DRM detection based on decoding errors.
    
    This is called when audio loading/decoding fails, to determine if
    the failure was due to DRM protection.
    
    Args:
        filepath: Path to the audio file
        error_message: The error message from the failed decode attempt
    
    Returns:
        Tuple of (has_drm: bool, drm_type: Optional[str])
        - has_drm: True if error indicates DRM
        - drm_type: Description of likely DRM type
    """
    try:
        error_lower = error_message.lower()
        
        # Common error patterns that indicate DRM
        drm_indicators = [
            'drm',
            'protected',
            'encrypted',
            'decrypt',
            'fairplay',
            'rights',
            'license',
            'authorization',
            'codec not found',  # Sometimes DRM uses proprietary codecs
            'invalid data found',  # Encrypted data appears invalid
        ]
        
        # Check if error message contains DRM indicators
        for indicator in drm_indicators:
            if indicator in error_lower:
                logger.info(f"DRM detected via error analysis: '{indicator}' in error message")
                
                # Try to identify DRM type based on file extension and error
                file_ext = Path(filepath).suffix.lower()
                if file_ext in ['.m4p', '.m4a', '.m4b']:
                    return True, "FairPlay (Apple Music)"
                elif file_ext == '.wma':
                    return True, "Windows Media DRM"
                else:
                    return True, "Unknown DRM"
        
        # Check file extension as fallback
        file_ext = Path(filepath).suffix.lower()
        if file_ext == '.m4p':
            # .m4p is always DRM-protected
            logger.info(f"DRM detected: .m4p extension with decode failure")
            return True, "FairPlay (Apple Music)"
        
        # No DRM indicators found
        return False, None
    
    except Exception as e:
        logger.error(f"Error during deep DRM check: {e}")
        return False, None


def is_drm_protected(filepath: str) -> Tuple[bool, Optional[str]]:
    """
    Convenience function that performs quick DRM check.
    
    Args:
        filepath: Path to the audio file
    
    Returns:
        Tuple of (has_drm: bool, drm_type: Optional[str])
    """
    return quick_drm_check(filepath)
