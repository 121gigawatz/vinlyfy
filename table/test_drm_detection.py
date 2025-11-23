"""
Test DRM detection functionality
"""

import os
import sys
import tempfile
import logging
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

# Import directly from drm_detector to avoid Flask dependencies
import drm_detector
quick_drm_check = drm_detector.quick_drm_check
deep_drm_check = drm_detector.deep_drm_check
DRMProtectedError = drm_detector.DRMProtectedError

logger = logging.getLogger(__name__)

def test_m4p_extension_detection():
    """Test that .m4p files are detected as DRM-protected"""
    logger.info("Test 1: M4P extension detection")
    
    # Create a temporary .m4p file (doesn't need to be valid audio)
    with tempfile.NamedTemporaryFile(suffix='.m4p', delete=False) as f:
        temp_path = f.name
        f.write(b'fake audio data')
    
    try:
        has_drm, drm_type = quick_drm_check(temp_path)
        assert has_drm == True, "M4P file should be detected as DRM-protected"
        assert "FairPlay" in drm_type, f"Expected FairPlay DRM type, got: {drm_type}"
        logger.info(f"  ✅ PASS: M4P detected as {drm_type}")
    finally:
        os.unlink(temp_path)


def test_non_drm_mp3():
    """Test that regular MP3 files are not flagged as DRM"""
    logger.info("\nTest 2: Non-DRM MP3 detection")
    
    # Create a temporary .mp3 file
    with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as f:
        temp_path = f.name
        f.write(b'fake mp3 data')
    
    try:
        has_drm, drm_type = quick_drm_check(temp_path)
        assert has_drm == False, "Regular MP3 should not be detected as DRM-protected"
        assert drm_type is None, f"Expected no DRM type, got: {drm_type}"
        logger.info(f"  ✅ PASS: MP3 correctly identified as non-DRM")
    finally:
        os.unlink(temp_path)


def test_deep_drm_check_with_error_indicators():
    """Test deep DRM check with error messages containing DRM indicators"""
    logger.info("\nTest 3: Deep DRM check with error indicators")
    
    # Create a temporary .m4a file
    with tempfile.NamedTemporaryFile(suffix='.m4a', delete=False) as f:
        temp_path = f.name
        f.write(b'fake audio data')
    
    try:
        # Test with various DRM-related error messages
        test_cases = [
            ("File is encrypted and cannot be decoded", True, "encrypted"),
            ("DRM protection detected", True, "DRM"),
            ("Invalid codec - protected content", True, "protected"),
            ("File not found", False, None),  # Non-DRM error
        ]
        
        for error_msg, expected_drm, indicator in test_cases:
            has_drm, drm_type = deep_drm_check(temp_path, error_msg)
            if expected_drm:
                assert has_drm == True, f"Error '{error_msg}' should indicate DRM"
                logger.info(f"  ✅ PASS: '{indicator}' detected in error message")
            else:
                assert has_drm == False, f"Error '{error_msg}' should not indicate DRM"
                logger.info(f"  ✅ PASS: Non-DRM error correctly identified")
    finally:
        os.unlink(temp_path)


def test_various_extensions():
    """Test DRM detection with various file extensions"""
    logger.info("\nTest 4: Various file extensions")
    
    extensions = ['.mp3', '.wav', '.flac', '.ogg', '.m4a']
    
    for ext in extensions:
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as f:
            temp_path = f.name
            f.write(b'fake audio data')
        
        try:
            has_drm, drm_type = quick_drm_check(temp_path)
            # Only .m4p should be detected as DRM in quick check
            assert has_drm == False, f"{ext} file should not be flagged as DRM in quick check"
            logger.info(f"  ✅ PASS: {ext} correctly identified as non-DRM")
        finally:
            os.unlink(temp_path)


def test_drm_protected_error():
    """Test that DRMProtectedError can be raised and caught"""
    logger.info("\nTest 5: DRMProtectedError exception")
    
    try:
        raise DRMProtectedError("Test DRM error")
    except DRMProtectedError as e:
        assert "Test DRM error" in str(e)
        logger.info(f"  ✅ PASS: DRMProtectedError raised and caught successfully")


def run_all_tests():
    """Run all DRM detection tests"""
    logger.info("=" * 60)
    logger.info("DRM Detection Test Suite")
    logger.info("=" * 60)
    
    try:
        test_m4p_extension_detection()
        test_non_drm_mp3()
        test_deep_drm_check_with_error_indicators()
        test_various_extensions()
        test_drm_protected_error()
        
        logger.info("\n" + "=" * 60)
        logger.info("✅ All tests passed!")
        logger.info("=" * 60)
        return True
    except AssertionError as e:
        logger.error(f"\n❌ Test failed: {e}")
        return False
    except Exception as e:
        logger.error(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
