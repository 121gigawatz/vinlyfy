# ========================
# API Routes
# ========================

from flask import Blueprint, request, jsonify, send_file
from werkzeug.exceptions import RequestEntityTooLarge
import os
import logging
from .vinyl_processor import VinylProcessor
from .config import Config
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
    Get supported input and output formats.

    Returns:
        JSON response with supports formats
    """
    return jsonify({
        'input_formats': list(Config.ALLOWED_EXTENSIONS),
        'output_formats': ['wav', 'mp3', 'flac', 'ogg']
    }), 200

@api.route('/process', methods=['POST'])
def process_audio():
    """
    Main endpoint for processing audio files with vinyl effects.

    Expected form data:
        - !audio: Audio file
        - ?preset: Preset name (default: 'medium')
        - ?output_format: Output format (default: 'wav')
        - Custom settings when preset = 'custom':
            - frequency_response (bool)
            - surface_noise (bool)
            - noise_intensity (float 0.0 - 0.1)
            - wow_flutter (bool)
            - wow_flutter_intensity (float 0.0 - 0.01)
            - harmonic_distortion (bool)
            - distortion_amount (float 0.0 - 1.0)
            - stereo_reduction (bool)
            - stereo_width (float 0.0 - 1.0)
    
    Returns:
        Processed audio file
    """
    temp_input_path = None
    temp_output_path = None

    try:
        # Check is audio file is present
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        
        audio_file = request.files['audio']

        if audio_file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Validate file extension
        if not allowed_file(audio_file.filename, Config.ALLOWED_EXTENSIONS):
            return jsonify({
                'error': f'Unsupported file format. Allowed {", ".join(Config.ALLOWED_EXTENSIONS)}'
            }), 400
        
        # Get preset and output format
        preset_name = request.form.get('preset', 'medium').lower()
        output_format = request.form.get('output_format', 'wav').lower()

        # Validate preset
        if preset_name not in Config.PRESETS:
            return jsonify({
                'error': f'Invalid preset. Available presets are {",".join(Config.PRESETS.keys())}'
            }), 400
        
        # Get base settings from preset
        settings = Config.PRESETS[preset_name].copy()

        # If custom preset, override with user desired settings
        if preset_name == 'custom':
            custom_settings = {
                'frequency_repsonse': parse_boolean(request.form.get('frequency_response', True)),
                'surface_noise': parse_boolean(request.form.get('surface_noise', True)),
                'noise_intensity': float(request.form.get('noise_intensity', 0.02)),
                'wow_flutter': parse_boolean(request.form.get('wow_flutter', True)),
                'wow_flutter_intensity': float(request.form.get('wow_flutter_intensity', 0.001)),
                'harmonic_distortion': parse_boolean(request.form.get('harmonic_distortion', True)),
                'distortion_amount': float(request.form.get('distortion_amount', 0.15)),
                'stereo_reduction': parse_boolean(request.form.get('stereo_reduction', True)),
                'stereo_width': float(request.form.get('stereo_width', 0.7))
            }

            settings = merge_settings(settings, custom_settings)

        # Validate settings
        is_valid, error_msg = validate_audio_settings(settings)
        if not is_valid:
            return jsonify({'error': f'Invalid settings: {error_msg}'}), 400
        
        logger.info(f"Processing file: {audio_file.filename} with {preset_name} preset")

        # Create temporary input file
        file_ext = audio_file.filename.rsplit('.', 1)[1].lower()
        _, temp_input_path = create_temp_file(suffix=f'.{file_ext}')
        audio_file.save(temp_input_path)

        # Get input file info
        inpout_info = get_audio_info(temp_input_path)
        logger.info(f"Input file: {inpout_info}")

        # Initialize audio processor and load audio
        processor = VinylProcessor(sample_rate=Config.DEFAULT_SAMPLE_RATE)
        audio_data, sample_rate = processor.load_audio(temp_input_path)

        # Update processor sample rate if different
        if sample_rate != Config.DEFAULT_SAMPLE_RATE:
            processor.sample_rate = sample_rate
            logger.info(f"Updated sample rate to: {sample_rate} Hz")
        
        # Process audio with vinyl effects
        processed_audio = processor.process(audio_data, settings)

        # Create temp output file
        _, temp_output_path = create_temp_file(f'.{output_format}')

        # Save processed audio
        processor.save_audio(processed_audio, temp_output_path, output_format)

        # Get output file info
        output_info = get_audio_info(temp_output_path)
        logger.info(f"Output file: {output_info}")

        # Prepare filename for download
        original_name = os.path.splitext(audio_file.filename)[0]
        safe_name = sanitize_filename(original_name)
        download_name = f"{safe_name}_vinylfy.{output_format}"

        # Send file
        return send_file(
            temp_output_path,
            mimetype=f'audio/{output_format}',
            as_attachment=True,
            download_name=download_name
        )
    except RequestEntityTooLarge:
        return jsonify({
            'error': f'File too large. Maximum size is {Config.MAX_CONTENT_LENGTH // (1024*1024)} MB'
        }), 413
    
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        return jsonify({'error': str(e)}), 400
    
    except Exception as e:
        logger.error(f"Processing error: {e}", exc_info=True)
        return jsonify({'error': 'An error occurred during processing'}), 500
    
    finally:
        # Cleaning up temp files
        if temp_input_path:
            cleanup_temp_file(temp_input_path)
        if temp_output_path:
            cleanup_temp_file(temp_output_path)

@api.route('/validate', methods=['POST'])
def validate_settings():
    """
    Validate custom settings without processing audio. 
    Useful for front end to check settings before sending to processor.

    Expects JSON dictionary of settings

    Returns JSON response with validation result
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
    """ Handle file too large errors """
    return jsonify({
        'error': f'File too large. Maximum size is {Config.MAX_CONTENT_LENGTH // (1024*1024)} MB'
    }), 413

@api.errorhandler(500)
def internal_server_error(error):
    """ Handle internal server errors """
    logger.error(f"Internal server error: {error}")
    return jsonify({
        'error': 'Internal server error occured'
    }), 500
