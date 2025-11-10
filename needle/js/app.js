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
    this.outputFormat = 'mp3';
    this.audioPlayer = null;
    this.presets = {};
    this.customSettings = this.getDefaultCustomSettings();
    this.isLoadingPreset = false; // Flag to prevent auto-switching to custom during preset load

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
    this.setupThemeToggle();

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
        healthStatus.textContent = '🟢 Turntable Spinning';
        healthStatus.className = 'badge badge-success';
      } else {
        throw new Error('API unhealthy');
      }
    } catch (error) {
      healthStatus.textContent = '🔴 Turntable Stopped';
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
    const howItWorks = document.getElementById('howItWorks');

    if (!isValidAudioFile(file)) {
      showToast('Invalid file type. Please select an audio file.', 'error');
      return;
    }

    this.selectedFile = file;
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    fileInfo.classList.remove('hidden');

    document.getElementById('processBtn').disabled = false;

    // Move "How It Works" section down when file is uploaded
    if (howItWorks) {
      howItWorks.style.marginTop = 'var(--space-xl)';
    }

    showToast('File loaded successfully!', 'success');
  }

  /**
   * Setup preset selector
   */
  setupPresetSelector() {
    const presetSelector = document.getElementById('presetSelector');

    presetSelector.addEventListener('change', (e) => {
      this.currentPreset = e.target.value;
      this.loadPresetValues(e.target.value);
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

    // Preset descriptions for better UX
    const presetDescriptions = {
      'AJW Recommended': 'AJW Recommended - Perfect balance',
      'light': 'Light - Subtle vinyl character',
      'medium': 'Medium - Classic vinyl sound',
      'heavy': 'Heavy - Well-worn record',
      'vintage': 'Vintage - Old, heavily-played',
      'custom': 'Custom - Full control'
    };

    Object.keys(this.presets).forEach(preset => {
      const option = document.createElement('option');
      option.value = preset;
      option.textContent = presetDescriptions[preset] || formatPresetName(preset);
      presetSelector.appendChild(option);
    });

    presetSelector.value = this.currentPreset;
    this.loadPresetValues(this.currentPreset);
    this.updateCustomControlsVisibility();
  }

  /**
   * Load preset values into UI controls
   */
  loadPresetValues(presetName) {
    if (!this.presets[presetName]) {
      console.warn(`Preset ${presetName} not found`);
      return;
    }

    const preset = this.presets[presetName];

    // Set flag to prevent auto-switching to custom
    this.isLoadingPreset = true;

    // Update custom settings from preset
    this.customSettings = { ...preset };

    // Update UI controls to reflect preset values
    this.updateCustomControlValues();

    // Reset flag
    this.isLoadingPreset = false;
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
      this.switchToCustomPreset();
    });

    // Surface noise toggle and intensity
    const surfaceNoiseToggle = document.getElementById('surfaceNoise');
    const noiseIntensity = document.getElementById('noiseIntensity');
    const noiseIntensityValue = document.getElementById('noiseIntensityValue');

    surfaceNoiseToggle.addEventListener('change', (e) => {
      this.customSettings.surface_noise = e.target.checked;
      this.switchToCustomPreset();
    });

    noiseIntensity.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      this.customSettings.noise_intensity = value;
      noiseIntensityValue.textContent = value.toFixed(3);
      this.switchToCustomPreset();
    });

    // Wow/Flutter toggle and intensity
    const wowFlutterToggle = document.getElementById('wowFlutter');
    const wowFlutterIntensity = document.getElementById('wowFlutterIntensity');
    const wowFlutterValue = document.getElementById('wowFlutterValue');

    wowFlutterToggle.addEventListener('change', (e) => {
      this.customSettings.wow_flutter = e.target.checked;
      this.switchToCustomPreset();
    });

    wowFlutterIntensity.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      this.customSettings.wow_flutter_intensity = value;
      wowFlutterValue.textContent = value.toFixed(4);
      this.switchToCustomPreset();
    });

    // Harmonic distortion toggle and amount
    const harmonicDistortionToggle = document.getElementById('harmonicDistortion');
    const distortionAmount = document.getElementById('distortionAmount');
    const distortionValue = document.getElementById('distortionValue');

    harmonicDistortionToggle.addEventListener('change', (e) => {
      this.customSettings.harmonic_distortion = e.target.checked;
      this.switchToCustomPreset();
    });

    distortionAmount.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      this.customSettings.distortion_amount = value;
      distortionValue.textContent = value.toFixed(2);
      this.switchToCustomPreset();
    });

    // Stereo reduction toggle and width
    const stereoReductionToggle = document.getElementById('stereoReduction');
    const stereoWidth = document.getElementById('stereoWidth');
    const stereoWidthValue = document.getElementById('stereoWidthValue');

    stereoReductionToggle.addEventListener('change', (e) => {
      this.customSettings.stereo_reduction = e.target.checked;
      this.switchToCustomPreset();
    });

    stereoWidth.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      this.customSettings.stereo_width = value;
      stereoWidthValue.textContent = value.toFixed(2);
      this.switchToCustomPreset();
    });
  }

  /**
   * Switch to custom preset when user changes any setting
   */
  switchToCustomPreset() {
    // Don't switch to custom if we're loading a preset
    if (this.isLoadingPreset) {
      return;
    }

    const presetSelector = document.getElementById('presetSelector');
    if (this.currentPreset !== 'custom') {
      this.currentPreset = 'custom';
      presetSelector.value = 'custom';
      this.savePreferences();
    }
  }

  /**
   * Update custom controls visibility
   * Note: Custom controls are now always visible
   */
  updateCustomControlsVisibility() {
    // Custom controls are now always shown
    // This method is kept for backwards compatibility but does nothing
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
   * Setup theme toggle
   */
  setupThemeToggle() {
    const themeButtons = document.querySelectorAll('.theme-toggle-btn');

    // Load saved theme or default to 'auto'
    const savedTheme = localStorage.getItem('theme') || 'auto';
    this.applyTheme(savedTheme);

    // Setup click handlers
    themeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = btn.dataset.theme;
        this.applyTheme(theme);
        localStorage.setItem('theme', theme);
      });
    });
  }

  /**
   * Apply theme
   */
  applyTheme(theme) {
    const html = document.documentElement;
    const themeButtons = document.querySelectorAll('.theme-toggle-btn');

    if (theme === 'auto') {
      // Use browser/OS preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      html.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      html.setAttribute('data-theme', theme);
    }

    // Update active state
    themeButtons.forEach(btn => {
      if (btn.dataset.theme === theme) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
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
    const discardBtn = document.getElementById('discardBtn');

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

    // Setup discard button
    discardBtn.onclick = () => this.discardAudio(result.file_id);

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
   * Discard processed audio and reset the UI
   */
  async discardAudio(fileId) {
    // Show warning confirmation
    const confirmed = confirm(
      '⚠️ Warning: Are you sure you want to discard this file?\n\n' +
      'This will delete the processed audio from the server and reset your settings. ' +
      'This action cannot be undone.'
    );

    if (!confirmed) {
      return;
    }

    const discardBtn = document.getElementById('discardBtn');

    try {
      discardBtn.disabled = true;
      discardBtn.innerHTML = '<span class="spinner spinner-sm"></span> Discarding...';

      // Delete file from server
      await api.deleteFile(fileId);

      // Stop and hide audio player if playing
      if (this.audioPlayer) {
        this.audioPlayer.stop();
        this.audioPlayer.hide();
      }

      // Hide results section
      const resultsSection = document.getElementById('resultsSection');
      resultsSection.classList.add('hidden');

      // Clear processed file ID
      this.processedFileId = null;

      // Scroll back to top
      window.scrollTo({ top: 0, behavior: 'smooth' });

      showToast('File discarded successfully. You can now try different settings or upload a new file.', 'success');

    } catch (error) {
      console.error('Discard failed:', error);
      showToast(`Failed to discard file: ${parseErrorMessage(error)}`, 'error');
    } finally {
      discardBtn.disabled = false;
      discardBtn.innerHTML = '🗑️ Discard';
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

    // Install prompt for Android/Desktop
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

    // iOS-specific install prompt
    this.setupIOSInstallPrompt();
  }

  /**
   * Setup iOS install prompt banner
   */
  setupIOSInstallPrompt() {
    // Check if device is iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isInStandaloneMode = ('standalone' in window.navigator) && window.navigator.standalone;

    // Don't show if not iOS, already installed, or user dismissed it
    if (!isIOS || isInStandaloneMode || localStorage.getItem('vinylfy_ios_install_dismissed')) {
      return;
    }

    // Create iOS install banner
    const banner = document.createElement('div');
    banner.id = 'iosInstallBanner';
    banner.innerHTML = `
      <div style="
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: linear-gradient(135deg, var(--color-primary) 0%, #b8894d 100%);
        color: white;
        padding: var(--space-md);
        box-shadow: 0 -4px 12px rgba(0,0,0,0.3);
        z-index: 9999;
        animation: slideUp 0.3s ease-out;
      ">
        <div style="max-width: 600px; margin: 0 auto; display: flex; align-items: center; gap: var(--space-md);">
          <img src="/assets/icons/apple-touch-icon.png" alt="Vinylfy" style="width: 48px; height: 48px; border-radius: 10px; flex-shrink: 0;">
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: var(--font-weight-semibold); margin-bottom: var(--space-xs);">
              Install Vinylfy
            </div>
            <div style="font-size: var(--font-size-sm); opacity: 0.95;">
              Tap <svg viewBox="0 0 24 24" style="width: 1em; height: 1em; display: inline; vertical-align: middle; fill: currentColor; margin: 0 2px;"><path d="M12 2C11.5 2 11 2.19 10.59 2.59L2.59 10.59C1.8 11.37 1.8 12.63 2.59 13.41C3.37 14.2 4.63 14.2 5.41 13.41L11 7.83V19C11 20.1 11.9 21 13 21S15 20.1 15 19V7.83L20.59 13.41C21.37 14.2 22.63 14.2 23.41 13.41C24.2 12.63 24.2 11.37 23.41 10.59L15.41 2.59C15 2.19 14.5 2 12 2Z"/></svg> then "Add to Home Screen"
            </div>
          </div>
          <button id="iosInstallClose" style="
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          ">×</button>
        </div>
      </div>
    `;

    document.body.appendChild(banner);

    // Close button handler
    document.getElementById('iosInstallClose').addEventListener('click', () => {
      banner.remove();
      localStorage.setItem('vinylfy_ios_install_dismissed', 'true');
    });

    // Auto-hide after 30 seconds
    setTimeout(() => {
      if (banner.parentNode) {
        banner.style.animation = 'slideDown 0.3s ease-out';
        setTimeout(() => banner.remove(), 300);
      }
    }, 30000);
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
        const presetSelector = document.getElementById('presetSelector');
        if (presetSelector) {
          presetSelector.value = prefs.preset;
        }

        // If it's a custom preset, load saved custom settings
        // Otherwise, load the preset values from the server
        if (prefs.preset === 'custom' && prefs.customSettings) {
          this.customSettings = { ...this.customSettings, ...prefs.customSettings };
          this.updateCustomControlValues();
        } else if (this.presets[prefs.preset]) {
          // Load preset values for non-custom presets
          this.loadPresetValues(prefs.preset);
        }

        this.updateCustomControlsVisibility();
      }

      if (prefs.outputFormat) {
        this.outputFormat = prefs.outputFormat;
        document.getElementById('formatSelector').value = prefs.outputFormat;
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