# EQ and Filter Controls - Quick Reference

## New Parameters

All settings objects now support these additional parameters:

```python
{
    # 3-Band EQ (all in dB, range: -5 to +5)
    'bass': 0.0,        # Bass control @ 100 Hz
    'mid': 0.0,         # Mid control @ 1000 Hz
    'treble': 0.0,      # Treble control @ 8000 Hz
    
    # High-Pass Filter (removes low frequencies)
    'hpf_enabled': False,
    'hpf_cutoff': 30,   # Hz (range: 20-500)
    
    # Low-Pass Filter (removes high frequencies)
    'lpf_enabled': False,
    'lpf_cutoff': 15000,  # Hz (range: 5000-20000)
}
```

## Preset Defaults

| Preset | Bass | Mid | Treble | HPF Cutoff | LPF Cutoff | LPF Enabled |
|--------|------|-----|--------|------------|------------|-------------|
| AJW Recommended | 0 | 0 | 0 | 30 Hz | 15 kHz | No |
| light | 0 | 0 | +1 | 30 Hz | 16 kHz | No |
| medium | 0 | 0 | 0 | 30 Hz | 15 kHz | No |
| heavy | +2 | 0 | -1 | 30 Hz | 14 kHz | No |
| vintage | +3 | 0 | -2 | 40 Hz | 12 kHz | **Yes** |
| custom | 0 | 0 | 0 | 30 Hz | 15 kHz | No |

## Common Use Cases

### Warm Vinyl Sound
```python
settings = {
    'bass': 2.0,
    'mid': 0.0,
    'treble': -1.5,
    'lpf_enabled': True,
    'lpf_cutoff': 13000,
}
```

### Bright, Clean Sound
```python
settings = {
    'bass': 0.0,
    'mid': 0.0,
    'treble': 2.0,
    'hpf_enabled': True,
    'hpf_cutoff': 40,
}
```

### Remove Rumble Only
```python
settings = {
    'bass': 0.0,
    'mid': 0.0,
    'treble': 0.0,
    'hpf_enabled': True,
    'hpf_cutoff': 50,  # Remove everything below 50 Hz
}
```

### Telephone/Lo-Fi Effect
```python
settings = {
    'bass': -3.0,
    'mid': 2.0,
    'treble': -2.0,
    'hpf_enabled': True,
    'hpf_cutoff': 300,
    'lpf_enabled': True,
    'lpf_cutoff': 8000,
}
```

## Frequency Ranges

### Bass (100 Hz center)
- Affects: ~50-200 Hz
- Use for: Warmth, fullness, punch
- Boost: More bass, warmer
- Cut: Less muddy, cleaner

### Mid (1000 Hz center)
- Affects: ~500-2000 Hz
- Use for: Vocal presence, instrument clarity
- Boost: More presence, forward sound
- Cut: Less nasal, more space

### Treble (8000 Hz shelf)
- Affects: 4000+ Hz
- Use for: Brightness, air, detail
- Boost: Brighter, more detail
- Cut: Darker, smoother, vintage

### HPF (High-Pass Filter)
- Removes: Everything below cutoff
- Typical: 20-100 Hz
- Use for: Removing rumble, cleaning up low end

### LPF (Low-Pass Filter)
- Removes: Everything above cutoff
- Typical: 10000-16000 Hz
- Use for: Vintage warmth, removing harshness

## API Example (cURL)

```bash
curl -X POST http://localhost:8888/api/process \
  -F "file=@song.mp3" \
  -F "preset=custom" \
  -F "bass=2.0" \
  -F "mid=-1.0" \
  -F "treble=1.5" \
  -F "hpf_enabled=true" \
  -F "hpf_cutoff=40" \
  -F "lpf_enabled=false"
```

## Python Example

```python
from vinyl_processor import VinylProcessor

processor = VinylProcessor(sample_rate=44100)

# Load audio
audio, sr = processor.load_audio('input.wav')

# Custom settings with EQ
settings = {
    'frequency_response': True,
    'surface_noise': True,
    'noise_intensity': 0.02,
    'pop_intensity': 0.6,
    'wow_flutter': True,
    'wow_flutter_intensity': 0.001,
    'harmonic_distortion': True,
    'distortion_amount': 0.15,
    'stereo_reduction': True,
    'stereo_width': 0.7,
    
    # New EQ controls
    'bass': 2.5,
    'mid': -0.5,
    'treble': 1.0,
    
    # New filter controls
    'hpf_enabled': True,
    'hpf_cutoff': 35,
    'lpf_enabled': True,
    'lpf_cutoff': 14000,
}

# Process
processed = processor.process(audio, settings)

# Save
processor.save_audio(processed, 'output.wav')
```

## Notes

- All EQ values are in **dB** (decibels)
- All frequency values are in **Hz** (hertz), not MHz
- Filters use 2nd order Butterworth design (12 dB/octave)
- EQ uses peaking filters for bass/mid, shelf for treble
- Processing is optimized - zero values skip processing
- All filters are zero-phase (no time delay)
