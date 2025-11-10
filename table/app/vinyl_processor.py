# ======================================
# CORE AUDIO PROCESSING
# ======================================

import numpy as np
from scipy import signal
from scipy.io import wavfile
import soundfile as sf
from pydub import AudioSegment
import logging
from typing import Tuple, Optional
import io

logger = logging.getLogger(__name__)

# CORE AUDIO PROCESSING FOR APPLYING VINYL EFFECTS

class VinylProcessor:
    """Class for applying vinyl record effects to audio."""

    def __init__(self, sample_rate: int = 44100):
        self.sample_rate = sample_rate
        logger.info(f"Vinyl Processing engine initialized with sample rate: {sample_rate} Hz")

    def load_audio(self, filepath: str) -> Tuple[np.ndarray, int]:
        try:
            # Try with soundfile first (better quality)
            audio_data, sample_rate = sf.read(filepath, dtype='float32')
            logger.info(f"Loaded audio: {audio_data.shape}, {sample_rate} Hz")
            return audio_data, sample_rate
        except Exception as e:
            logger.warning(f"soundfile failed, trying pydub: {e}")
            # Fallback to pydub for more format support
            audio_segment = AudioSegment.from_file(filepath)
            audio_segment = audio_segment.set_frame_rate(self.sample_rate)

            # Convert to numpy array
            samples = np.array(audio_segment.get_array_of_samples(), dtype=np.float32)
            samples = samples / 32768.0 # Normalize to -1.0 to 1.0

            # Reshape for stereo
            if audio_segment.channels == 2:
                samples = samples.reshape((-1, 2))

            return samples, audio_segment.frame_rate

    def add_surface_noise(self, audio: np.ndarray, intensity: float = 0.02, pop_intensity: float = 0.5) -> np.ndarray:
        """
        Add vinyl surface noise including crackles and pops.

        Args:
            audio: Input audio array
            intensity: Overall noise intensity (0.0 to 0.1)
            pop_intensity: Pop loudness multiplier (0.0 to 1.0, where 0.5 is balanced)
        """
        logger.debug(f"Adding surface noise with intensity: {intensity}, pop_intensity: {pop_intensity}")

        # White noise (hiss)
        noise = np.random.normal(0, intensity * 0.5, audio.shape)

        # Add occasional pops (random impulses) - MORE FREQUENT AND LOUDER
        pop_probability = 0.0006 # Doubled from 0.0003 - About 26-30 pops per second at 44.1kHz
        pops = np.random.random(audio.shape) < pop_probability
        pop_volume = intensity * 12 * pop_intensity # Base louder pops, scaled by pop_intensity parameter
        pop_sound = pops * np.random.uniform(-pop_volume, pop_volume, audio.shape)

        # Add crackles (short bursts) - MORE FREQUENT
        crackle_probability = 0.0003 # Doubled from 0.00015
        crackles = np.random.random(audio.shape) < crackle_probability
        crackle_sound = crackles * np.random.normal(0, intensity * 4, audio.shape)

        return audio + noise + pop_sound + crackle_sound

    # Apply RIAA equalization curve to simulate vinyl frequency response
    # Rolls off high frequencies and reduces extreme lows
    def apply_frequency_response(self, audio: np.ndarray) -> np.ndarray:
        logger.debug("Applying frequency response curve")

        # Nyquist frequency
        nyquist = self.sample_rate / 2

        # High frequency rolloff (vinyl can't reproduce frequencies above ~15kHz well)
        high_cutoff = 15000 / nyquist
        b_high, a_high = signal.butter(4, high_cutoff, 'low')
        audio = signal.filtfilt(b_high, a_high, audio, axis=0)

        # Low frequency rolloff (rumble filter, removes subsonic noise)
        low_cutoff = 30 / nyquist
        b_low, a_low = signal.butter(2, low_cutoff, 'high')
        audio = signal.filtfilt(b_low, a_low, audio, axis=0)

        # Mid-range boost (vinyl characteristic warmth around 1-3kHz)
        # Create a gentle peak filter
        center_freq = 2000 / nyquist
        Q = 1.0 # Quality factor
        b_peak, a_peak = signal.iirpeak(center_freq, Q)
        audio = signal.filtfilt(b_peak, a_peak, audio, axis=0) * 0.1 + audio * 0.9

        return audio

    # Add wow and flutter - pitch variations from turntable speed inconsistencies
    # Wow slow variations (~0.5 Hz) | Flutter is faster variations (~6 Hz)

    def add_wow_flutter(self, audio: np.ndarray, intensity: float = 0.001) -> np.ndarray:
        logger.debug(f"Adding wow and flutter with intensity: {intensity}")

        duration = len(audio) / self.sample_rate
        t = np.linspace(0, duration, len(audio))

        wow_freq = 0.5 + np.random.uniform(-0.1, 0.1) # Slight randomization
        wow = intensity * np.sin(2 * np.pi * wow_freq * t)

        flutter_freq = 6.0 + np.random.uniform(-1, 1)
        flutter = intensity * 0.5 * np.sin(2 * np.pi * flutter_freq * t)

        modulation = 1 + wow + flutter # Combine wow and flutter

        # Apply pitch modulation
        result = audio.copy()
        if len(audio.shape) == 2: # Stereo
            for channel in range(audio.shape[1]):
                result[:, channel] = audio[:, channel] * modulation
        else: # Mono
            result = audio * modulation

        return result

    # Add harmonic distortion for analog warmth using soft clipping
    def add_harmonic_distortion(self, audio: np.ndarray, amount: float = 0.15) -> np.ndarray:
        logger.debug(f"Adding harmonic distortion with amount: {amount}")

        # Soft clipping using tanh (smooth, musical distortion)
        gain = 1 + amount * 2 # Convert 0-1 range to 1-3 gain
        distorted = np.tanh(audio * gain)

        distorted = distorted / np.tanh(gain) # Normalize to prevent excessive volume change

        # Mix with original signal for subtlety
        mix = 0.7 # 70% disorted, 30% clean
        return distorted * mix + audio * (1 - mix)

    # Reduce stereo separation - vinyl has limited separation versus digital
    def reduce_stereo_width(self, audio: np.ndarray, width: float = 0.7) -> np.ndarray:
        if len (audio.shape) == 1:
            logger.debug("Audio is mono, skipping stereo reduction")
            return audio

        logger.debug(f"Reducing stereo width to: {width}")

        # Mid-side processing
        left = audio[:, 0]
        right = audio[:, 1]

        # Calculate mid and side signals
        mid = (left + right) / 2
        side = (left - right) / 2

        # Reduce side signal based on width param
        side = side * width

        # Reconstruct stereo signal
        new_left = mid + side
        new_right = mid - side

        return np.column_stack([new_left, new_right])

    # APPLY ALL EFFECTS FROM SETTINGS - RETURN PROCESSED AUDIO ARRAY
    def process(self, audio: np.ndarray, settings: dict) -> np.ndarray:
        logger.info(f"Processing audio with shape: {audio.shape}")

        # Ensure audio is in float32 format
        audio = audio.astype(np.float32)

        # Normalize to -1 to 1 range if needed
        if audio.max() > 1.0 or audio.min() < -1.0:
            audio = audio / np.abs(audio).max()

        # Apply effects in order
        if settings.get('frequency_response', True):
            audio = self.apply_frequency_response(audio)

        if settings.get('harmonic_distortion', True):
            amount = settings.get('distortion_amount', 0.15)
            audio = self.add_harmonic_distortion(audio, amount)

        if settings.get('wow_flutter', True):
            intensity = settings.get('wow_flutter_intensity', 0.001)
            audio = self.add_wow_flutter(audio, intensity)

        if settings.get('surface_noise', True):
            intensity = settings.get('noise_intensity', 0.02)
            pop_intensity = settings.get('pop_intensity', 0.5)
            audio = self.add_surface_noise(audio, intensity, pop_intensity)

        if settings.get('stereo_reduction', True) and len(audio.shape) == 2:
            width = settings.get('stereo_width', 0.7)
            audio = self.reduce_stereo_width(audio, width)

        # Final normalization to prevent clipping
        audio = np.clip(audio, -1.0, 1.0)

        # Soft limiting to catch any remaining peaks
        audio = np.tanh(audio * 0.95) / np.tanh(0.95)

        logger.info("Processing complete")
        return audio

    # Save processed audio to file
    def save_audio(self, audio: np.ndarray, output_path: str, output_format: str = 'wav') -> None:
        try:
            if output_format.lower() == 'wav':
                # use soundfile for high-quality WAV output
                sf.write(output_path, audio, self.sample_rate, subtype='PCM_16')
                logger.info(f"Saved audio to {output_path} as WAV")
            else:
                # Convert to 16-bit for pydub
                audio_int16 = (audio * 32767).astype(np.int16)

                # Create AudioSegment
                if len(audio.shape) == 2: # Stereo
                    audio_segment = AudioSegment(
                        audio_int16.tobytes(),
                        frame_rate=self.sample_rate,
                        sample_width=2,
                        channels=2
                    )
                else: # Mono
                    audio_segment = AudioSegment(
                        audio_int16.tobytes(),
                        frame_rate=self.sample_rate,
                        sample_width=2,
                        channels=1
                    )

                # Export to desired format
                audio_segment.export(output_path, format=output_format)
                logger.info(f"Saved audio to {output_path} as {output_format.upper()}")

        except Exception as e:
            logger.error(f"Error saving audio file: {e}")
            raise
