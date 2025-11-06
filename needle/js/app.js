/**
 * Main Application Logic for Vinylfy
 */

import api from './api.js';
import AudioPlayer from './audio-player.js';
import {
  formatFileSize,
  isValidAudioFile,
  showToast,
  storage,
  validateSettings,
  formatPresetName,
  parseErrorMessage,
  isPWAInstalled
} from './utils.js';

class VinylApp {
  constructor() {
    this.selectedFile = null;
    this.processedFileId = null;
    this.currentPreset = 'medium';
    this.outputFormat = 'wav';
    this.audioPlayer = null;
    this.presets = {};
    this.customSettings = this.getDefaultCustomSettings();
    
    this.init();
  }

  /**
   * Initialize the application
   */
  async init() {
    console.log('🎵 Vinylfy initializing...');
    
    // Check API health
    await this.checkAPIHealth();
    
    // Load presets and formats
    await this.loadPresets();
    
    // Setup UI
    this.setupFileUpload();
    this.setupPresetSelector();
    this.setupFormatSelector();
    this.setupCustomControls();
    this.setupProcessButton();
    
    // Initialize audio player
    this.audioPlayer = new AudioPlayer('audioPlayerContainer');
    this.audioPlayer.hide();
    
    // Setup PWA
    this.setupPWA();
    
    // Load saved preferences
    this.loadPreferences();
    
    console.log('✅ Vinylfy ready!');
  }

  /**
   * Check if API is available
   */
  async checkAPIHealth() {
    const healthStatus = document.getElementById('healthStatus');
    
    try {
      const health = await api.checkHealth();
      if (health.healthy) {
        healthStatus.textContent = '🟢 Connected';
        healthStatus.className = 'badge badge-success';
      } else {
        throw new Error('API unhealthy');
      }
    } catch (error) {
      healthStatus.textContent = '🔴 Disconnected';
      healthStatus.className = 'badge badge-error';
      showToast('Cannot connect to server. Please check if the table is running.', 'error', 5000);
    }
  }

  /**
   * Load presets from API
   */
  async loadPresets() {
    try {
      const data = await api.getPresets();
      this.presets = data.presets;
      this.populatePresetSelector();
    } catch (error) {
      console.error('Failed to load presets:', error);
      showToast('Failed to load presets', 'error');
    }
  }

  /**
   * Setup file upload
   */
  setupFileUpload() {
    const fileInput = document.getElementById('audioFile');
    const fileLabel = document.getElementById('fileUploadLabel');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');

    // File input change
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        this.handleFileSelect(file);
      }
    });

    // Drag and drop
    fileLabel.addEventListener('dragover', (e) => {
      e.preventDefault();
      fileLabel.classList.add('drag-over');
    });

    fileLabel.addEventListener('dragleave', () => {
      fileLabel.classList.remove('drag-over');
    });

    fileLabel.addEventListener('drop', (e) => {
      e.preventDefault();
      fileLabel.classList.remove('drag-over');
      
      const file = e.dataTransfer.files[0];
      if (file) {
        this.handleFileSelect(file);
      }
    });
  }

  /**
   * Handle file selection
   */
  handleFileSelect(file) {
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    const fileInfo = document.getElementById('fileInfo');

    if (!isValidAudioFile(file)) {
      showToast('Invalid file type. Please select an audio file.', 'error');
      return;
    }

    this.selectedFile = file;
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    fileInfo.classList.remove('hidden');
    
    document.getElementById('processBtn').disabled = false;
    
    showToast('File loaded successfully!', 'success');
  }

  /**
   * Setup preset selector
   */
  setupPresetSelector() {
    const presetSelector = document.getElementById('presetSelector');
    
    presetSelector.addEventListener('change', (e) => {
      this.currentPreset = e.target.value;
      this.updateCustomControlsVisibility();
      this.savePreferences();
    });
  }

  /**
   * Populate preset selector with options
   */
  populatePresetSelector() {
    const presetSelector = document.getElementById('presetSelector');
    presetSelector.innerHTML = '';

    Object.keys(this.presets).forEach(preset => {
      const option = document.createElement('option');
      option.value = preset;
      option.textContent = formatPresetName(preset);
      presetSelector.appendChild(option);
    });

    presetSelector.value = this.currentPreset;
    this.updateCustomControlsVisibility();
  }

  /**
   * Setup output format selector
   */
  setupFormatSelector() {
    const formatSelector = document.getElementById('formatSelector');
    
    formatSelector.addEventListener('change', (e) => {
      this.outputFormat = e.target.value;
      this.savePreferences();
    });
  }

  /**
   * Setup custom controls
   */
  setupCustomControls() {
    // Frequency response toggle
    const frequencyResponseToggle = document.getElementById('frequencyResponse');
    frequencyResponseToggle.addEventListener('change', (e) => {
      this.customSettings.frequency_response = e.target.checked;
    });

    // Surface noise toggle and intensity
    const surfaceNoiseToggle = document.getElementById('surfaceNoise');
    const noiseIntensity = document.getElementById('noiseIntensity');
    const noiseIntensityValue = document.getElementById('noiseIntensityValue');

    surfaceNoiseToggle.addEventListener('change', (e) => {
      this.customSettings.surface_noise = e.target.checked;
    });

    noiseIntensity.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      this.customSettings.noise_intensity = value;
      noiseIntensityValue.textContent = value.toFixed(3);
    });

    // Wow/Flutter toggle and intensity
    const wowFlutterToggle = document.getElementById('wowFlutter');
    const wowFlutterIntensity = document.getElementById('wowFlutterIntensity');
    const wowFlutterValue = document.getElementById('wowFlutterValue');

    wowFlutterToggle.addEventListener('change', (e) => {
      this.customSettings.wow_flutter = e.target.checked;
    });

    wowFlutterIntensity.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      this.customSettings.wow_flutter_intensity = value;
      wowFlutterValue.textContent = value.toFixed(4);
    });

    // Harmonic distortion toggle and amount
    const harmonicDistortionToggle = document.getElementById('harmonicDistortion');
    const distortionAmount = document.getElementById('distortionAmount');
    const distortionValue = document.getElementById('distortionValue');

    harmonicDistortionToggle.addEventListener('change', (e) => {
      this.customSettings.harmonic_distortion = e.target.checked;
    });

    distortionAmount.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      this.customSettings.distortion_amount = value;
      distortionValue.textContent = value.toFixed(2);
    });

    // Stereo reduction toggle and width
    const stereoReductionToggle = document.getElementById('stereoReduction');
    const stereoWidth = document.getElementById('stereoWidth');
    const stereoWidthValue = document.getElementById('stereoWidthValue');

    stereoReductionToggle.addEventListener('change', (e) => {
      this.customSettings.stereo_reduction = e.target.checked;
    });

    stereoWidth.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      this.customSettings.stereo_width = value;
      stereoWidthValue.textContent = value.toFixed(2);
    });
  }

  /**
   * Update custom controls visibility
   */
  updateCustomControlsVisibility() {
    const customControls = document.getElementById('customControls');
    
    if (this.currentPreset === 'custom') {
      customControls.classList.remove('hidden');
    } else {
      customControls.classList.add('hidden');
    }
  }

  /**
   * Setup process button
   */
  setupProcessButton() {
    const processBtn = document.getElementById('processBtn');
    
    processBtn.addEventListener('click', () => {
      this.processAudio();
    });
  }

  /**
   * Process audio file
   */
  async processAudio() {
    if (!this.selectedFile) {
      showToast('Please select an audio file first', 'error');
      return;
    }

    const processBtn = document.getElementById('processBtn');
    const processingIndicator = document.getElementById('processingIndicator');
    const resultsSection = document.getElementById('resultsSection');

    try {
      // Show processing state
      processBtn.disabled = true;
      processBtn.innerHTML = '<span class="spinner spinner-sm"></span> Processing...';
      processingIndicator.classList.remove('hidden');
      resultsSection.classList.add('hidden');
      this.audioPlayer.hide();

      // Prepare options
      const options = {
        preset: this.currentPreset,
        outputFormat: this.outputFormat
      };

      // Add custom settings if custom preset
      if (this.currentPreset === 'custom') {
        const validation = validateSettings(this.customSettings);
        if (!validation.valid) {
          throw new Error(validation.errors.join(', '));
        }
        options.settings = this.customSettings;
      }

      // Process audio
      const result = await api.processAudio(this.selectedFile, options);
      
      this.processedFileId = result.file_id;
      
      // Show results
      this.showResults(result);
      
      showToast('Processing complete! 🎵', 'success');
      
    } catch (error) {
      console.error('Processing failed:', error);
      showToast(`Processing failed: ${parseErrorMessage(error)}`, 'error', 5000);
    } finally {
      // Reset button state
      processBtn.disabled = false;
      processBtn.textContent = 'Process Audio';
      processingIndicator.classList.add('hidden');
    }
  }

  /**
   * Show processing results
   */
  showResults(result) {
    const resultsSection = document.getElementById('resultsSection');
    const resultFileName = document.getElementById('resultFileName');
    const resultFileSize = document.getElementById('resultFileSize');
    const resultPreset = document.getElementById('resultPreset');
    const resultFormat = document.getElementById('resultFormat');
    const expiresIn = document.getElementById('expiresIn');
    const previewBtn = document.getElementById('previewBtn');
    const downloadBtn = document.getElementById('downloadBtn');

    // Update result info
    resultFileName.textContent = result.suggested_filename;
    resultFileSize.textContent = result.file_size_formatted;
    resultPreset.textContent = formatPresetName(result.preset);
    resultFormat.textContent = result.output_format.toUpperCase();
    
    const minutes = Math.floor(result.expires_in_seconds / 60);
    expiresIn.textContent = `${minutes} minutes`;

    // Setup preview button
    previewBtn.onclick = () => this.previewAudio(result.file_id);

    // Setup download button
    downloadBtn.onclick = () => this.downloadAudio(result.file_id);

    // Show results section
    resultsSection.classList.remove('hidden');
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /**
   * Preview processed audio
   */
  previewAudio(fileId) {
    const previewUrl = api.getPreviewURL(fileId);
    this.audioPlayer.load(previewUrl);
    this.audioPlayer.show();
    
    showToast('Loading preview...', 'info');
  }

  /**
   * Download processed audio
   */
  async downloadAudio(fileId) {
    const downloadBtn = document.getElementById('downloadBtn');
    
    try {
      downloadBtn.disabled = true;
      downloadBtn.innerHTML = '<span class="spinner spinner-sm"></span> Downloading...';
      
      const { blob, filename } = await api.downloadFile(fileId);
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showToast('Download started! 🎉', 'success');
      
    } catch (error) {
      console.error('Download failed:', error);
      showToast(`Download failed: ${parseErrorMessage(error)}`, 'error');
    } finally {
      downloadBtn.disabled = false;
      downloadBtn.innerHTML = '⬇ Download';
    }
  }

  /**
   * Get default custom settings
   */
  getDefaultCustomSettings() {
    return {
      frequency_response: true,
      surface_noise: true,
      noise_intensity: 0.02,
      wow_flutter: true,
      wow_flutter_intensity: 0.001,
      harmonic_distortion: true,
      distortion_amount: 0.15,
      stereo_reduction: true,
      stereo_width: 0.7
    };
  }

  /**
   * Setup PWA functionality
   */
  setupPWA() {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js')
        .then(registration => {
          console.log('Service Worker registered:', registration);
        })
        .catch(error => {
          console.error('Service Worker registration failed:', error);
        });
    }

    // Install prompt
    let deferredPrompt;
    const installBtn = document.getElementById('installBtn');

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      
      if (installBtn && !isPWAInstalled()) {
        installBtn.classList.remove('hidden');
      }
    });

    if (installBtn) {
      installBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          console.log(`Install prompt outcome: ${outcome}`);
          deferredPrompt = null;
          installBtn.classList.add('hidden');
        }
      });
    }

    // Hide install button if already installed
    if (isPWAInstalled() && installBtn) {
      installBtn.classList.add('hidden');
    }
  }

  /**
   * Save user preferences
   */
  savePreferences() {
    storage.set('vinylfy_preferences', {
      preset: this.currentPreset,
      outputFormat: this.outputFormat,
      customSettings: this.customSettings
    });
  }

  /**
   * Load user preferences
   */
  loadPreferences() {
    const prefs = storage.get('vinylfy_preferences');
    
    if (prefs) {
      if (prefs.preset) {
        this.currentPreset = prefs.preset;
        document.getElementById('presetSelector').value = prefs.preset;
        this.updateCustomControlsVisibility();
      }
      
      if (prefs.outputFormat) {
        this.outputFormat = prefs.outputFormat;
        document.getElementById('formatSelector').value = prefs.outputFormat;
      }
      
      if (prefs.customSettings) {
        this.customSettings = { ...this.customSettings, ...prefs.customSettings };
        this.updateCustomControlValues();
      }
    }
  }

  /**
   * Update custom control values from saved settings
   */
  updateCustomControlValues() {
    document.getElementById('frequencyResponse').checked = this.customSettings.frequency_response;
    document.getElementById('surfaceNoise').checked = this.customSettings.surface_noise;
    document.getElementById('noiseIntensity').value = this.customSettings.noise_intensity;
    document.getElementById('noiseIntensityValue').textContent = this.customSettings.noise_intensity.toFixed(3);
    document.getElementById('wowFlutter').checked = this.customSettings.wow_flutter;
    document.getElementById('wowFlutterIntensity').value = this.customSettings.wow_flutter_intensity;
    document.getElementById('wowFlutterValue').textContent = this.customSettings.wow_flutter_intensity.toFixed(4);
    document.getElementById('harmonicDistortion').checked = this.customSettings.harmonic_distortion;
    document.getElementById('distortionAmount').value = this.customSettings.distortion_amount;
    document.getElementById('distortionValue').textContent = this.customSettings.distortion_amount.toFixed(2);
    document.getElementById('stereoReduction').checked = this.customSettings.stereo_reduction;
    document.getElementById('stereoWidth').value = this.customSettings.stereo_width;
    document.getElementById('stereoWidthValue').textContent = this.customSettings.stereo_width.toFixed(2);
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new VinylApp();
  });
} else {
  new VinylApp();
}

export default VinylApp;