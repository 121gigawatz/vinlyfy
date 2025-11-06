from flask import Blueprint, request, jsonify, send_file
from werkzeug.exceptions import RequestEntityTooLarge
import os
import logging
from .vinyl_processor import VinylProcessor
from .config import Config
from .file_manager import ProcessedFileManager
from .utils import (
    allowed_file, 
    create_temp_file, 
    cleanup_temp_file,
    validate_audio_settings,
    merge_settings,
    get_audio_info,
    parse_boolean,
    sanitize_filename
)

logger = logging.getLogger(__name__)

# Create Blueprint
api = Blueprint('api', __name__)

# Initialize file manager
file_manager = ProcessedFileManager(
    storage_dir=Config.PROCESSED_FILES_DIR,
    ttl_hours=Config.PROCESSED_FILES_TTL_HOURS
)


@api.route('/health', methods=['GET'])
def health_check():
    """
    Health check endpoint for monitoring.
    
    Returns:
        JSON response with status
    """
    return jsonify({
        'status': 'healthy',
        'service': 'vinylfy-table',
        'version': '1.0.0'
    }), 200


@api.route('/presets', methods=['GET'])
def get_presets():
    """
    Get available vinyl effect presets.
    
    Returns:
        JSON response with all available presets and their settings
    """
    return jsonify({
        'presets': Config.PRESETS,
        'default': 'medium'
    }), 200


@api.route('/formats', methods=['GET'])
def get_supported_formats():
    """
    Get supported input and output audio formats.
    
    Returns:
        JSON response with supported formats
    """
    return jsonify({
        'input_formats': list(Config.ALLOWED_EXTENSIONS),
        'output_formats': ['wav', 'mp3', 'flac', 'ogg']
    }), 200


@api.route('/process', methods=['POST'])
def process_audio():
    """
    Main endpoint for processing audio files with vinyl effects.
    Returns a file ID for preview/download instead of the file itself.
    
    Expected form data:
        - audio: Audio file (required)
        - preset: Preset name (optional, default: 'medium')
        - output_format: Output format (optional, default: 'wav')
        - Custom settings when preset='custom':
            - frequency_response: bool
            - surface_noise: bool
            - noise_intensity: float (0.0-0.1)
            - wow_flutter: bool
            - wow_flutter_intensity: float (0.0-0.01)
            - harmonic_distortion: bool
            - distortion_amount: float (0.0-1.0)
            - stereo_reduction: bool
            - stereo_width: float (0.0-1.0)
    
    Returns:
        JSON with file ID and metadata for preview/download
    """
    temp_input_path = None
    temp_output_path = None
    
    try:
        # Check if audio file is present
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        
        audio_file = request.files['audio']
        
        if audio_file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Validate file extension
        if not allowed_file(audio_file.filename, Config.ALLOWED_EXTENSIONS):
            return jsonify({
                'error': f'Unsupported file format. Allowed: {", ".join(Config.ALLOWED_EXTENSIONS)}'
            }), 400
        
        # Get preset and output format
        preset_name = request.form.get('preset', 'medium').lower()
        output_format = request.form.get('output_format', 'wav').lower()
        
        # Validate preset
        if preset_name not in Config.PRESETS:
            return jsonify({
                'error': f'Invalid preset. Available: {", ".join(Config.PRESETS.keys())}'
            }), 400
        
        # Get base settings from preset
        settings = Config.PRESETS[preset_name].copy()
        
        # If custom preset, override with user-provided settings
        if preset_name == 'custom':
            custom_settings = {
                'frequency_response': parse_boolean(request.form.get('frequency_response', True)),
                'surface_noise': parse_boolean(request.form.get('surface_noise', True)),
                'noise_intensity': float(request.form.get('noise_intensity', 0.02)),
                'wow_flutter': parse_boolean(request.form.get('wow_flutter', True)),
                'wow_flutter_intensity': float(request.form.get('wow_flutter_intensity', 0.001)),
                'harmonic_distortion': parse_boolean(request.form.get('harmonic_distortion', True)),
                'distortion_amount': float(request.form.get('distortion_amount', 0.15)),
                'stereo_reduction': parse_boolean(request.form.get('stereo_reduction', True)),
                'stereo_width': float(request.form.get('stereo_width', 0.7)),
            }
            settings = merge_settings(settings, custom_settings)
        
        # Validate settings
        is_valid, error_msg = validate_audio_settings(settings)
        if not is_valid:
            return jsonify({'error': f'Invalid settings: {error_msg}'}), 400
        
        logger.info(f"Processing file: {audio_file.filename} with preset: {preset_name}")
        
        # Create temporary input file
        file_ext = audio_file.filename.rsplit('.', 1)[1].lower()
        _, temp_input_path = create_temp_file(suffix=f'.{file_ext}')
        audio_file.save(temp_input_path)
        
        # Get input file info
        input_info = get_audio_info(temp_input_path)
        logger.info(f"Input file: {input_info}")
        
        # Initialize processor and load audio
        processor = VinylProcessor(sample_rate=Config.DEFAULT_SAMPLE_RATE)
        audio_data, sample_rate = processor.load_audio(temp_input_path)
        
        # Update processor sample rate if different
        if sample_rate != Config.DEFAULT_SAMPLE_RATE:
            processor.sample_rate = sample_rate
            logger.info(f"Updated sample rate to: {sample_rate} Hz")
        
        # Process audio with vinyl effects
        processed_audio = processor.process(audio_data, settings)
        
        # Create temporary output file
        _, temp_output_path = create_temp_file(suffix=f'.{output_format}')
        
        # Save processed audio
        processor.save_audio(processed_audio, temp_output_path, output_format)
        
        # Get output file info
        output_info = get_audio_info(temp_output_path)
        logger.info(f"Output file: {output_info}")
        
        # Store file and get ID
        file_id = file_manager.store_file(
            filepath=temp_output_path,
            original_filename=audio_file.filename,
            output_format=output_format,
            preset=preset_name,
            settings=settings
        )
        
        # Prepare filename for download
        original_name = os.path.splitext(audio_file.filename)[0]
        safe_name = sanitize_filename(original_name)
        suggested_filename = f"{safe_name}_vinylfy.{output_format}"
        
        # Return file ID and metadata
        return jsonify({
            'success': True,
            'file_id': file_id,
            'original_filename': audio_file.filename,
            'suggested_filename': suggested_filename,
            'output_format': output_format,
            'preset': preset_name,
            'file_size': output_info['size'],
            'file_size_formatted': output_info['size_formatted'],
            'preview_url': f'/api/preview/{file_id}',
            'download_url': f'/api/download/{file_id}',
            'expires_in_seconds': Config.PROCESSED_FILES_TTL_HOURS * 3600
        }), 200
    
    except RequestEntityTooLarge:
        return jsonify({
            'error': f'File too large. Maximum size: {Config.MAX_CONTENT_LENGTH // (1024*1024)} MB'
        }), 413
    
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        return jsonify({'error': str(e)}), 400
    
    except Exception as e:
        logger.error(f"Processing error: {e}", exc_info=True)
        return jsonify({'error': 'An error occurred during processing'}), 500
    
    finally:
        # Cleanup temporary files
        if temp_input_path:
            cleanup_temp_file(temp_input_path)
        if temp_output_path:
            cleanup_temp_file(temp_output_path)




@api.route('/preview/<file_id>', methods=['GET'])
def preview_audio(file_id):
    """
    Stream processed audio for preview in the browser.
    
    Args:
        file_id: Unique file identifier
    
    Returns:
        Audio file stream for preview (not as attachment)
    """
    try:
        # Get file metadata
        metadata = file_manager.get_file(file_id)
        
        if not metadata:
            return jsonify({'error': 'File not found or expired'}), 404
        
        filepath = metadata['filepath']
        output_format = metadata['output_format']
        
        logger.info(f"Streaming preview for file: {file_id}")
        
        # Send file for streaming (not as attachment)
        return send_file(
            filepath,
            mimetype=f'audio/{output_format}',
            as_attachment=False  # Stream in browser
        )
    
    except Exception as e:
        logger.error(f"Preview error: {e}", exc_info=True)
        return jsonify({'error': 'Failed to stream preview'}), 500


@api.route('/download/<file_id>', methods=['GET'])
def download_audio(file_id):
    """
    Download processed audio file.
    
    Args:
        file_id: Unique file identifier
    
    Returns:
        Audio file as download
    """
    try:
        # Get file metadata
        metadata = file_manager.get_file(file_id)
        
        if not metadata:
            return jsonify({'error': 'File not found or expired'}), 404
        
        filepath = metadata['filepath']
        output_format = metadata['output_format']
        original_filename = metadata['original_filename']
        
        # Prepare download filename
        original_name = os.path.splitext(original_filename)[0]
        safe_name = sanitize_filename(original_name)
        download_name = f"{safe_name}_vinylfy.{output_format}"
        
        logger.info(f"Downloading file: {file_id}")
        
        # Send file as attachment
        return send_file(
            filepath,
            mimetype=f'audio/{output_format}',
            as_attachment=True,
            download_name=download_name
        )
    
    except Exception as e:
        logger.error(f"Download error: {e}", exc_info=True)
        return jsonify({'error': 'Failed to download file'}), 500


@api.route('/file/<file_id>', methods=['GET'])
def get_file_info(file_id):
    """
    Get information about a processed file without downloading it.
    
    Args:
        file_id: Unique file identifier
    
    Returns:
        JSON with file metadata
    """
    try:
        metadata = file_manager.get_file(file_id)
        
        if not metadata:
            return jsonify({'error': 'File not found or expired'}), 404
        
        # Remove internal filepath from response
        response_metadata = metadata.copy()
        response_metadata.pop('filepath', None)
        
        return jsonify(response_metadata), 200
    
    except Exception as e:
        logger.error(f"File info error: {e}")
        return jsonify({'error': 'Failed to get file info'}), 500


@api.route('/file/<file_id>', methods=['DELETE'])
def delete_file(file_id):
    """
    Manually delete a processed file before it expires.
    
    Args:
        file_id: Unique file identifier
    
    Returns:
        JSON with deletion status
    """
    try:
        success = file_manager.delete_file(file_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'File deleted successfully'
            }), 200
        else:
            return jsonify({'error': 'File not found'}), 404
    
    except Exception as e:
        logger.error(f"Delete error: {e}")
        return jsonify({'error': 'Failed to delete file'}), 500


@api.route('/stats', methods=['GET'])
def get_stats():
    """
    Get statistics about the file storage.
    
    Returns:
        JSON with storage statistics
    """
    try:
        stats = file_manager.get_stats()
        return jsonify(stats), 200
    except Exception as e:
        logger.error(f"Stats error: {e}")
        return jsonify({'error': 'Failed to get stats'}), 500


@api.route('/validate', methods=['POST'])
def validate_settings():
    """
    Validate custom settings without processing audio.
    Useful for the frontend to check settings before uploading.
    
    Expected JSON body:
        - settings: Dictionary of effect settings
    
    Returns:
        JSON response with validation result
    """
    try:
        data = request.get_json()
        
        if not data or 'settings' not in data:
            return jsonify({'error': 'No settings provided'}), 400
        
        settings = data['settings']
        is_valid, error_msg = validate_audio_settings(settings)
        
        if is_valid:
            return jsonify({
                'valid': True,
                'message': 'Settings are valid'
            }), 200
        else:
            return jsonify({
                'valid': False,
                'error': error_msg
            }), 400
    
    except Exception as e:
        logger.error(f"Validation error: {e}")
        return jsonify({'error': 'Invalid request format'}), 400


@api.errorhandler(413)
def request_entity_too_large(error):
    """Handle file too large errors"""
    return jsonify({
        'error': f'File too large. Maximum size: {Config.MAX_CONTENT_LENGTH // (1024*1024)} MB'
    }), 413


@api.errorhandler(500)
def internal_server_error(error):
    """Handle internal server errors"""
    logger.error(f"Internal server error: {error}")
    return jsonify({
        'error': 'Internal server error occurred'
    }), 500