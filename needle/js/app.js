/**
 * Main Application Logic for Vinylfy
 */

// App Configuration
const APP_VERSION = 'v1.0.0 Beta 2.4.3';

import api from './api.js?v=beta2.4.3';
import AudioPlayer from './audio-player.js?v=beta2.4.3';
import {
  formatFileSize,
  isValidAudioFile,
  showToast,
  storage,
  validateSettings,
  formatPresetName,
  parseErrorMessage,
  isPWAInstalled
} from './utils.js?v=beta2.4.3';
import {
  extractMetadata,
  writeMetadata,
  getEmptyMetadata,
  supportsMetadataWriting
} from './metadata.js?v=beta2.4.3';

class VinylApp {
  constructor() {
    this.selectedFile = null;
    this.processedFileId = null;
    this.currentPreset = 'AJW Recommended';
    this.outputFormat = 'mp3';
    this.audioPlayer = null;
    this.presets = {};
    this.customSettings = this.getDefaultCustomSettings();
    this.isLoadingPreset = false; // Flag to prevent auto-switching to custom during preset load
    this.appVersion = APP_VERSION;
    this.fileTTL = 1; // Default, will be updated from API
    this.maxUploadMB = 25; // Default, will be updated from API

    // Metadata handling
    this.originalMetadata = null;
    this.editedMetadata = null;
    this.isMetadataEditMode = false;
    this.uploadedArtwork = null;

    this.init();
  }

  /**
   * Initialize the application
   */
  async init() {
    console.log('🎵 Vinylfy initializing...');

    // Check for version mismatch and show modal if needed
    await this.checkCacheVersion();

    // Check for version change and clear old data
    await this.checkVersionAndCleanup();

    // Clear old caches on startup
    await this.clearOldCaches();

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
    this.setupGitHubStars();
    this.setupMetadataModal();

    // Initialize audio player
    this.audioPlayer = new AudioPlayer('audioPlayerContainer');
    this.audioPlayer.innerHTML = `<div class="audio-player" role="group" aria-label="Audio player controls">
        <div class="audio-controls">
          <button class "audio-play-btn" id="${this.id}-play-btn" aria-label="Play audio" aria-pressed="fasle">
            ▶
          </button>
          <div class="audio-timeline" id="${this.id}-timeline" aria-label="Audio timeline" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-valuetext="0 seconds of 0 seconds" tabindex="0">
          </div>
        </div>
        <div class="audio-time" aria-live="off">
          <span id="${this.id}-current-time" aria-label="Current time">0:00</span>
          <span id="${this.id}-duration" aria-label="Duration">0.00</span>
        </div>
      `;
    this.audioPlayer.hide();

    // Setup PWA
    this.setupPWA();

    // Load saved preferences
    this.loadPreferences();

    // Setup product tour (runs on first visit or version change)
    this.setupProductTour();

    console.log('✅ Vinylfy ready!');
  }

  /**
   * Check if app version has changed and cleanup if needed
   */
  async checkVersionAndCleanup() {
    try {
      const storedVersion = localStorage.getItem('vinylfy_version');
      const currentVersion = this.appVersion;

      if (storedVersion && storedVersion !== currentVersion) {
        console.log(`🔄 Version change detected: ${storedVersion} → ${currentVersion}`);
        console.log('🧹 Clearing all caches and storage...');

        // Clear all caches
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(name => caches.delete(name)));
          console.log('✅ All caches cleared');
        }

        // Unregister all service workers
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map(reg => reg.unregister()));
          console.log('✅ All service workers unregistered');
        }

        // Clear localStorage (except the version we're about to set)
        const itemsToKeep = ['vinylfy_preferences']; // Keep user preferences
        const allKeys = Object.keys(localStorage);
        allKeys.forEach(key => {
          if (key.startsWith('vinylfy_') && !itemsToKeep.includes(key)) {
            localStorage.removeItem(key);
          }
        });

        // Update stored version
        localStorage.setItem('vinylfy_version', currentVersion);
        console.log('✅ Version updated, reloading page...');

        // Force a hard reload to get fresh assets
        window.location.reload(true);
        return;
      }

      // Store version if not present
      if (!storedVersion) {
        localStorage.setItem('vinylfy_version', currentVersion);
        console.log(`✅ Version stored: ${currentVersion}`);
      }
    } catch (error) {
      console.warn('Version check failed (non-critical):', error);
    }
  }

  /**
   * Check for cache version mismatch and show modal
   */
  async checkCacheVersion() {
    try {
      // Get API version
      const health = await api.checkHealth();
      const serverVersion = health.version || 'unknown';
      const clientVersion = this.appVersion;

      // Check if versions match
      if (serverVersion !== clientVersion && serverVersion !== 'unknown') {
        console.warn(`⚠️ Version mismatch detected!`);
        console.warn(`Client: ${clientVersion}, Server: ${serverVersion}`);

        // Show the cache update modal
        this.showCacheUpdateModal(clientVersion, serverVersion);
      }
    } catch (error) {
      console.warn('Could not check cache version:', error);
    }
  }

  /**
   * Show cache update modal
   */
  async showCacheUpdateModal(cachedVersion, latestVersion) {
    const modal = document.getElementById('cacheUpdateModal');
    const cachedVersionEl = document.getElementById('cachedVersion');
    const latestVersionEl = document.getElementById('latestVersion');
    const clearCacheBtn = document.getElementById('clearCacheBtn');
    const dismissBtn = document.getElementById('dismissCacheModal');

    // Set version info
    cachedVersionEl.textContent = cachedVersion;
    latestVersionEl.textContent = latestVersion;

    // Load and display release notes for all versions between cached and latest
    await this.loadReleaseNotes(cachedVersion, latestVersion);
    this.trapFocus(this.showCacheUpdateModal);

    // Show modal
    modal.classList.remove('hidden');

    // Clear cache button
    clearCacheBtn.onclick = async () => {
      clearCacheBtn.disabled = true;
      clearCacheBtn.innerHTML = '<span class="spinner spinner-sm"></span> Clearing...';

      await this.clearAllCaches();

      // Force reload
      window.location.reload(true);
    };

    // Dismiss button
    dismissBtn.onclick = () => {
      modal.classList.add('hidden');
    };

    // Close on overlay click
    const overlay = modal.querySelector('.modal-overlay');
    overlay.onclick = () => {
      modal.classList.add('hidden');
    };
  }

  /**
   * Load and display release notes for all versions between cached and latest
   */
  async loadReleaseNotes(cachedVersion, latestVersion) {
    const releaseNotesSection = document.getElementById('releaseNotesSection');
    const releaseNotesContent = document.getElementById('releaseNotesContent');

    try {
      // Fetch release notes
      const response = await fetch('/release-notes.json');
      if (!response.ok) {
        throw new Error('Failed to fetch release notes');
      }

      const releaseNotes = await response.json();
      const allVersions = Object.keys(releaseNotes);

      // Find all versions between cached and latest (inclusive of latest)
      const versionsToShow = [];
      let foundLatest = false;

      for (const version of allVersions) {
        if (version === latestVersion) {
          foundLatest = true;
          versionsToShow.push(version);
        } else if (foundLatest) {
          versionsToShow.push(version);
          // Stop when we reach the cached version
          if (version === cachedVersion) {
            break;
          }
        }
      }

      // If we only found the latest version (same as cached), just show latest
      if (versionsToShow.length === 0 && releaseNotes[latestVersion]) {
        versionsToShow.push(latestVersion);
      }

      if (versionsToShow.length > 0) {
        let html = '';

        // Show each version's notes
        versionsToShow.forEach((version, index) => {
          const versionNotes = releaseNotes[version];
          if (!versionNotes) return;

          // Add version header
          if (versionsToShow.length > 1) {
            html += `<div style="margin-bottom: var(--space-md); ${index > 0 ? 'margin-top: var(--space-lg); padding-top: var(--space-md); border-top: 1px solid var(--color-border);' : ''}">`;
            html += `<h4 style="color: var(--color-primary); margin-bottom: var(--space-sm); font-size: var(--font-size-md);">${version}</h4>`;
          }

          // Add highlights
          if (versionNotes.highlights && versionNotes.highlights.length > 0) {
            html += '<div style="margin-bottom: var(--space-sm);">';
            html += '<strong style="color: var(--color-primary); font-size: var(--font-size-sm);">✨ Highlights:</strong>';
            html += '<ul style="margin: var(--space-xs) 0 0 0; padding-left: var(--space-lg); font-size: var(--font-size-sm);">';
            versionNotes.highlights.forEach(item => {
              html += `<li style="margin-bottom: var(--space-xs); color: var(--color-text-primary);">${item}</li>`;
            });
            html += '</ul></div>';
          }

          // Add bug fixes
          if (versionNotes.bugfixes && versionNotes.bugfixes.length > 0) {
            html += '<div style="margin-bottom: var(--space-sm);">';
            html += '<strong style="color: var(--color-primary); font-size: var(--font-size-sm);">🐛 Bug Fixes:</strong>';
            html += '<ul style="margin: var(--space-xs) 0 0 0; padding-left: var(--space-lg); font-size: var(--font-size-sm);">';
            versionNotes.bugfixes.forEach(item => {
              html += `<li style="margin-bottom: var(--space-xs); color: var(--color-text-secondary);">${item}</li>`;
            });
            html += '</ul></div>';
          }

          // Add improvements
          if (versionNotes.improvements && versionNotes.improvements.length > 0) {
            html += '<div style="margin-bottom: var(--space-sm);">';
            html += '<strong style="color: var(--color-primary); font-size: var(--font-size-sm);">⚡ Improvements:</strong>';
            html += '<ul style="margin: var(--space-xs) 0 0 0; padding-left: var(--space-lg); font-size: var(--font-size-sm);">';
            versionNotes.improvements.forEach(item => {
              html += `<li style="margin-bottom: var(--space-xs); color: var(--color-text-secondary);">${item}</li>`;
            });
            html += '</ul></div>';
          }

          if (versionsToShow.length > 1) {
            html += '</div>';
          }
        });

        // Update content and show section
        releaseNotesContent.innerHTML = html;
        releaseNotesSection.style.display = 'block';
      } else {
        // No release notes found
        releaseNotesSection.style.display = 'none';
      }
    } catch (error) {
      console.warn('Could not load release notes:', error);
      // Hide section if there's an error
      releaseNotesSection.style.display = 'none';
    }
  }

  /**
   * Clear all caches and service workers
   */
  async clearAllCaches() {
    try {
      console.log('🧹 Clearing all caches...');

      // Clear all browser caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.log('✅ All caches cleared');
      }

      // Unregister all service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(reg => reg.unregister()));
        console.log('✅ All service workers unregistered');
      }

      // Clear localStorage version to trigger fresh version check
      localStorage.removeItem('vinylfy_version');

      console.log('✅ Cache clearing complete!');
    } catch (error) {
      console.error('Error clearing caches:', error);
    }
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

        // Update app info from API
        if (health.config) {
          this.fileTTL = health.config.file_ttl_hours || 1;
          this.maxUploadMB = health.config.max_upload_mb || 25;
        }

        // Update footer with version and TTL
        this.updateFooterInfo();

        // Update file upload hint with max size
        this.updateFileUploadHint();
      } else {
        throw new Error('API unhealthy');
      }
    } catch (error) {
      healthStatus.textContent = '🔴 Turntable Stopped';
      healthStatus.className = 'badge badge-error';
      showToast('Cannot connect to server. Please check if the table is running.', 'error', 5000);

      // Still update footer and upload hint with defaults
      this.updateFooterInfo();
      this.updateFileUploadHint();
    }
  }

  /**
   * Clear old browser caches to ensure fresh assets
   */
  async clearOldCaches() {
    try {
      const currentVersion = 'beta2.4.3';

      // Clear browser caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        const oldCaches = cacheNames.filter(name =>
          !name.includes(currentVersion) && (name.includes('vinylfy') || name.includes('runtime'))
        );

        if (oldCaches.length > 0) {
          console.log(`🧹 Found ${oldCaches.length} old cache(s) to clear`);
          for (const cacheName of oldCaches) {
            console.log('🧹 Clearing old cache:', cacheName);
            await caches.delete(cacheName);
          }
        }
      }

      // Unregister old service workers and force update
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();

        for (const registration of registrations) {
          // Check if service worker has the current version
          const hasCurrentVersion = await this.checkServiceWorkerVersion(registration, currentVersion);

          if (!hasCurrentVersion) {
            console.log('🔄 Unregistering outdated service worker...');
            await registration.unregister();
            console.log('✅ Old service worker unregistered');
          } else if (registration.waiting) {
            // If there's a new SW waiting, activate it immediately
            console.log('🔄 Activating waiting service worker...');
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });

            // Reload page once new SW is activated
            navigator.serviceWorker.addEventListener('controllerchange', () => {
              console.log('🔄 Service worker updated, reloading page...');
              window.location.reload();
            }, { once: true });
          }
        }
      }
    } catch (error) {
      console.warn('Cache clearing failed (non-critical):', error);
    }
  }

  /**
   * Check if service worker has current version by checking cache names
   */
  async checkServiceWorkerVersion(registration, currentVersion) {
    try {
      // Get all cache names
      const cacheNames = await caches.keys();

      // Check if any cache with the current version exists
      const hasCurrentCache = cacheNames.some(name =>
        name.includes(currentVersion) && (name.includes('vinylfy') || name.includes('runtime'))
      );

      return hasCurrentCache;
    } catch (error) {
      console.warn('Version check failed:', error);
      return false; // Default to unregister if we can't check
    }
  }

  /**
   * Update footer with app version and file TTL info
   */
  updateFooterInfo() {
    // Update version
    const versionElement = document.getElementById('appVersion');
    if (versionElement) {
      versionElement.textContent = `Version: ${this.appVersion}`;
    }

    // Update TTL message
    const ttlElement = document.getElementById('fileTTL');
    if (ttlElement) {
      const ttlText = this.fileTTL === 1
        ? '1 hour'
        : `${this.fileTTL} hours`;
      ttlElement.textContent = `Files auto-delete after ${ttlText}`;
    }
  }

  /**
   * Update file upload hint with max file size from API
   */
  updateFileUploadHint() {
    const hintElement = document.getElementById('fileUploadHint');
    if (hintElement) {
      hintElement.textContent = `Supports: WAV, MP3, FLAC, OGG, M4A, AAC (Max ${this.maxUploadMB}MB)`;
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

    // How It Works button
    const howItWorksBtn = document.getElementById('howItWorksBtn');
    const howItWorksModal = document.getElementById('howItWorksModal');
    const closeHowItWorksBtn = document.getElementById('closeHowItWorksModal');

    howItWorksBtn.addEventListener('click', () => {
      howItWorksModal.classList.remove('hidden');
      this.trapFocus(howItWorksModal);
    });

    closeHowItWorksBtn.addEventListener('click', () => {
      howItWorksModal.classList.add('hidden');
    });

    // Close modal on overlay click
    const howItWorksOverlay = howItWorksModal.querySelector('.modal-overlay');
    howItWorksOverlay.addEventListener('click', () => {
      howItWorksModal.classList.add('hidden');
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

    // Reset metadata when new file is selected
    this.originalMetadata = null;
    this.editedMetadata = null;
    this.uploadedArtwork = null;

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

    // Define preset order
    const presetOrder = ['AJW Recommended', 'light', 'medium', 'heavy', 'vintage', 'custom'];

    // Add presets in specified order
    presetOrder.forEach(preset => {
      if (this.presets[preset]) {
        const option = document.createElement('option');
        option.value = preset;
        option.textContent = presetDescriptions[preset] || formatPresetName(preset);
        presetSelector.appendChild(option);
      }
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
      this.updateMetadataButtonState();
      this.savePreferences();
    });
  }

  /**
   * Update metadata button state based on selected format
   */
  updateMetadataButtonState() {
    const metadataBtn = document.getElementById('metadataBtn');
    if (!metadataBtn) return;

    if (supportsMetadataWriting(this.outputFormat)) {
      metadataBtn.disabled = false;
      metadataBtn.title = 'View and edit audio metadata';
    } else {
      metadataBtn.disabled = true;
      metadataBtn.title = `Metadata is only supported for MP3, FLAC, and AAC formats. Current format: ${this.outputFormat.toUpperCase()}`;
    }
  }

  /**
   * Setup custom controls
   */
  setupCustomControls() {
    // Frequency response toggle
    const frequencyResponseToggle = document.getElementById('frequencyResponse');
    frequencyResponseToggle.addEventListener('change', (e) => {
      this.customSettings.frequency_response = e.target.checked;
      e.target.setAttribute('aria-checked', e.target.checked);
      this.switchToCustomPreset();
    });

    // Surface noise toggle and intensity
    const surfaceNoiseToggle = document.getElementById('surfaceNoise');
    const noiseIntensity = document.getElementById('noiseIntensity');
    const noiseIntensityValue = document.getElementById('noiseIntensityValue');
    const noiseIntensityGroup = document.getElementById('noiseIntensityGroup');
    const popIntensity = document.getElementById('popIntensity');
    const popIntensityValue = document.getElementById('popIntensityValue');
    const popIntensityGroup = document.getElementById('popIntensityGroup');

    // Surface noise taggle listener
    surfaceNoiseToggle.addEventListener('change', (e) => {
      this.customSettings.surface_noise = e.target.checked;
      e.target.setAttribute('aria-checked', e.target.checked);
      // Hide/show slider groups instead of disabling
      noiseIntensityGroup.style.display = e.target.checked ? 'block' : 'none';
      popIntensityGroup.style.display = e.target.checked ? 'block' : 'none';
      this.switchToCustomPreset();
    });

    noiseIntensity.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      this.customSettings.noise_intensity = value;
      const valueText = value.toFixed(3);
      noiseIntensityValue.textContent = valueText;
      this.switchToCustomPreset();
    });

    // Pop intensity slider
    popIntensity.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      this.customSettings.pop_intensity = value;
      const valueText = value.toFixed(2);
      popIntensityValue.textContent = valueText;
      this.switchToCustomPreset();
    });

    // Wow/Flutter toggle and intensity
    const wowFlutterToggle = document.getElementById('wowFlutter');
    const wowFlutterIntensity = document.getElementById('wowFlutterIntensity');
    const wowFlutterValue = document.getElementById('wowFlutterValue');
    const wowFlutterIntensityGroup = document.getElementById('wowFlutterIntensityGroup');

    wowFlutterToggle.addEventListener('change', (e) => {
      this.customSettings.wow_flutter = e.target.checked;
      e.target.setAttribute('aria-checked', e.target.checked);
      // Hide/show slider group instead of disabling
      wowFlutterIntensityGroup.style.display = e.target.checked ? 'block' : 'none';
      this.switchToCustomPreset();
    });

    wowFlutterIntensity.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      this.customSettings.wow_flutter_intensity = value;
      const valueText = value.toFixed(4);
      wowFlutterValue.textContent = valueText;
      this.switchToCustomPreset();
    });

    // Harmonic distortion toggle and amount
    const harmonicDistortionToggle = document.getElementById('harmonicDistortion');
    const distortionAmount = document.getElementById('distortionAmount');
    const distortionValue = document.getElementById('distortionValue');
    const distortionAmountGroup = document.getElementById('distortionAmountGroup');

    harmonicDistortionToggle.addEventListener('change', (e) => {
      this.customSettings.harmonic_distortion = e.target.checked;
      e.target.setAttribute('aria-checked', e.target.checked);
      // Hide/show slider group instead of disabling
      distortionAmountGroup.style.display = e.target.checked ? 'block' : 'none';
      this.switchToCustomPreset();
    });

    distortionAmount.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      this.customSettings.distortion_amount = value;
      const valueText = value.toFixed(2);
      distortionValue.textContent = valueText;
      this.switchToCustomPreset();
    });

    // Stereo reduction toggle and width
    const stereoReductionToggle = document.getElementById('stereoReduction');
    const stereoWidth = document.getElementById('stereoWidth');
    const stereoWidthValue = document.getElementById('stereoWidthValue');
    const stereoWidthGroup = document.getElementById('stereoWidthGroup');

    stereoReductionToggle.addEventListener('change', (e) => {
      this.customSettings.stereo_reduction = e.target.checked;
      e.target.setAttribute('aria-checked', e.target.checked);
      // Hide/show slider group instead of disabling
      stereoWidthGroup.style.display = e.target.checked ? 'block' : 'none';
      this.switchToCustomPreset();
    });

    stereoWidth.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      this.customSettings.stereo_width = value;
      const valueText = value.toFixed(2);
      stereoWidthValue.textContent = valueText;
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
   * Setup GitHub stars
   */
  setupGitHubStars() {
    // Extract repo info from the link's href attribute
    const githubLink = document.getElementById('githubLink');
    if (!githubLink) return;

    const href = githubLink.getAttribute('href');
    const match = href.match(/github\.com\/([^\/]+)\/([^\/]+)/);

    if (!match) {
      console.warn('Could not parse GitHub repo from URL');
      return;
    }

    const [, owner, repo] = match;
    this.fetchGitHubStars(owner, repo);
  }

  /**
   * Fetch GitHub stars count
   */
  async fetchGitHubStars(owner, repo) {
    const starNumber = document.getElementById('starNumber');

    try {
      // Check cache first (cache for 1 hour)
      const cacheKey = `github_stars_${owner}_${repo}`;
      const cached = localStorage.getItem(cacheKey);
      const cacheTime = localStorage.getItem(`${cacheKey}_time`);

      if (cached && cacheTime) {
        const age = Date.now() - parseInt(cacheTime);
        if (age < 3600000) { // 1 hour
          starNumber.textContent = this.formatStarCount(parseInt(cached));
          return;
        }
      }

      // Fetch from GitHub API with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`GitHub API returned ${response.status}`);
      }

      const data = await response.json();
      const stars = data.stargazers_count;

      // Update UI
      starNumber.textContent = this.formatStarCount(stars);

      // Cache the result
      localStorage.setItem(cacheKey, stars.toString());
      localStorage.setItem(`${cacheKey}_time`, Date.now().toString());

    } catch (error) {
      console.warn('Failed to fetch GitHub stars:', error);
      starNumber.textContent = '—';
    }
  }

  /**
   * Format star count for display
   */
  formatStarCount(count) {
    if (count >= 1000) {
      return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    return count.toString();
  }

  /**
   * Setup metadata modal
   */
  setupMetadataModal() {
    const metadataBtn = document.getElementById('metadataBtn');
    const metadataModal = document.getElementById('metadataModal');
    const closeMetadataModal = document.getElementById('closeMetadataModal');
    const editMetadataBtn = document.getElementById('editMetadataBtn');
    const saveMetadataBtn = document.getElementById('saveMetadataBtn');
    const artworkFile = document.getElementById('artworkFile');
    const removeArtwork = document.getElementById('removeArtwork');

    // Open modal
    metadataBtn.addEventListener('click', async () => {
      await this.openMetadataModal();
      this.trapFocus(metadataModal);
    });

    // Close modal
    closeMetadataModal.addEventListener('click', () => {
      metadataModal.classList.add('hidden');
      this.resetMetadataEditMode();
    });

    // Close on overlay click
    const modalOverlay = metadataModal.querySelector('.modal-overlay');
    modalOverlay.addEventListener('click', () => {
      metadataModal.classList.add('hidden');
      this.resetMetadataEditMode();
    });

    // Edit metadata button
    editMetadataBtn.addEventListener('click', () => {
      this.enableMetadataEditMode();
    });

    // Save metadata button
    saveMetadataBtn.addEventListener('click', () => {
      this.saveMetadataChanges();
    });

    // Artwork upload
    artworkFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        this.handleArtworkUpload(file);
      }
    });

    // Remove artwork
    removeArtwork.addEventListener('click', () => {
      this.uploadedArtwork = null;
      document.getElementById('artworkPreview').classList.add('hidden');
      document.getElementById('artworkFile').value = '';
    });
  }

  /**
   * Open metadata modal and load metadata from uploaded file
   */
  async openMetadataModal() {
    const metadataModal = document.getElementById('metadataModal');
    const metadataNotice = document.getElementById('metadataNotice');

    // Check if output format is MP3
    if (!supportsMetadataWriting(this.outputFormat)) {
      metadataNotice.classList.remove('hidden');
    } else {
      metadataNotice.classList.add('hidden');
    }

    // Extract metadata from uploaded file if we haven't already
    if (!this.originalMetadata && this.selectedFile) {
      try {
        showToast('Extracting metadata...', 'info');
        this.originalMetadata = await extractMetadata(this.selectedFile);
        this.editedMetadata = { ...this.originalMetadata };
        console.log('Metadata extracted:', this.originalMetadata);
      } catch (error) {
        console.error('Failed to extract metadata:', error);
        this.originalMetadata = getEmptyMetadata();
        this.editedMetadata = { ...this.originalMetadata };
      }
    }

    // Populate modal with metadata
    this.populateMetadataModal();

    // Show modal
    metadataModal.classList.remove('hidden');
  }

  /**
   * Populate metadata modal with current metadata
   */
  populateMetadataModal() {
    const metadata = this.editedMetadata || this.originalMetadata || getEmptyMetadata();

    // Populate text fields
    document.getElementById('metaTitle').value = metadata.title || '';
    document.getElementById('metaArtist').value = metadata.artist || '';
    document.getElementById('metaAlbum').value = metadata.album || '';
    document.getElementById('metaYear').value = metadata.year || '';
    document.getElementById('metaGenre').value = metadata.genre || '';
    document.getElementById('metaTrack').value = metadata.track || '';
    document.getElementById('metaComment').value = metadata.comment || '';

    // Show album artwork if available
    const albumArtworkSection = document.getElementById('albumArtworkSection');
    const albumArtwork = document.getElementById('albumArtwork');

    if (metadata.picture && metadata.picture.data) {
      const { data, format } = metadata.picture;
      const blob = new Blob([new Uint8Array(data)], { type: format });
      const url = URL.createObjectURL(blob);
      albumArtwork.src = url;
      albumArtworkSection.classList.remove('hidden');
    } else {
      albumArtworkSection.classList.add('hidden');
    }
  }

  /**
   * Enable metadata edit mode
   */
  enableMetadataEditMode() {
    this.isMetadataEditMode = true;

    // Enable all input fields
    document.getElementById('metaTitle').removeAttribute('readonly');
    document.getElementById('metaArtist').removeAttribute('readonly');
    document.getElementById('metaAlbum').removeAttribute('readonly');
    document.getElementById('metaYear').removeAttribute('readonly');
    document.getElementById('metaGenre').removeAttribute('readonly');
    document.getElementById('metaTrack').removeAttribute('readonly');
    document.getElementById('metaComment').removeAttribute('readonly');

    // Show save button, hide edit button
    document.getElementById('editMetadataBtn').classList.add('hidden');
    document.getElementById('saveMetadataBtn').classList.remove('hidden');

    // Show artwork upload section if MP3 format
    if (supportsMetadataWriting(this.outputFormat)) {
      document.getElementById('artworkUploadSection').classList.remove('hidden');
    }

    showToast('Edit mode enabled', 'info');
  }

  /**
   * Reset metadata edit mode
   */
  resetMetadataEditMode() {
    this.isMetadataEditMode = false;

    // Make fields readonly
    document.getElementById('metaTitle').setAttribute('readonly', true);
    document.getElementById('metaArtist').setAttribute('readonly', true);
    document.getElementById('metaAlbum').setAttribute('readonly', true);
    document.getElementById('metaYear').setAttribute('readonly', true);
    document.getElementById('metaGenre').setAttribute('readonly', true);
    document.getElementById('metaTrack').setAttribute('readonly', true);
    document.getElementById('metaComment').setAttribute('readonly', true);

    // Show edit button, hide save button
    document.getElementById('editMetadataBtn').classList.remove('hidden');
    document.getElementById('saveMetadataBtn').classList.add('hidden');

    // Hide artwork upload section
    document.getElementById('artworkUploadSection').classList.add('hidden');
  }

  /**
   * Save metadata changes
   */
  saveMetadataChanges() {
    // Get values from form
    this.editedMetadata = {
      title: document.getElementById('metaTitle').value,
      artist: document.getElementById('metaArtist').value,
      album: document.getElementById('metaAlbum').value,
      year: document.getElementById('metaYear').value,
      genre: document.getElementById('metaGenre').value,
      track: document.getElementById('metaTrack').value,
      comment: document.getElementById('metaComment').value,
      picture: this.uploadedArtwork || (this.originalMetadata && this.originalMetadata.picture) || null
    };

    console.log('Metadata saved:', this.editedMetadata);
    showToast('Metadata changes saved!', 'success');

    this.resetMetadataEditMode();
    document.getElementById('metadataModal').classList.add('hidden');
  }

  /**
   * Handle artwork upload
   */
  async handleArtworkUpload(file) {
    if (!file.type.match(/^image\/(jpeg|png)$/)) {
      showToast('Please upload a JPEG or PNG image', 'error');
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      this.uploadedArtwork = {
        data: new Uint8Array(arrayBuffer),
        format: file.type
      };

      // Show preview
      const artworkPreview = document.getElementById('artworkPreview');
      const artworkPreviewImg = document.getElementById('artworkPreviewImg');
      const blob = new Blob([arrayBuffer], { type: file.type });
      const url = URL.createObjectURL(blob);
      artworkPreviewImg.src = url;
      artworkPreview.classList.remove('hidden');

      showToast('Artwork uploaded successfully', 'success');
    } catch (error) {
      console.error('Failed to upload artwork:', error);
      showToast('Failed to upload artwork', 'error');
    }
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

      // Reset progress bar
      this.updateProgress(0);

      // Show processing tour on first use
      this.showProcessingTour();

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

      // Start simulated progress
      const progressInterval = this.simulateProgress();

      // Process audio
      const result = await api.processAudio(this.selectedFile, options);

      // Clear progress interval and set to 100%
      clearInterval(progressInterval);
      this.updateProgress(100);

      // Brief delay to show completion state
      await new Promise(resolve => setTimeout(resolve, 800));

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

      // Reset progress bar
      this.updateProgress(0);
    }
  }

  /**
   * Update progress bar and status text
   */
  updateProgress(percent) {
    const progressBar = document.getElementById('progressBar');
    const progressPercent = document.getElementById('progressPercent');
    const processingStatus = document.getElementById('processingStatus');

    if (!progressBar || !progressPercent || !processingStatus) return;

    // Update progress bar width
    progressBar.style.width = `${percent}%`;
    progressPercent.textContent = `${Math.round(percent)}%`;

    // Update status text based on progress
    if (percent >= 0 && percent <= 33) {
      processingStatus.textContent = 'Grabbing the record...'
    } else if (percent > 33 && percent <= 66) {
      processingStatus.textContent = 'Loading the turntable...';
    } else if (percent > 66 && percent < 100) {
      processingStatus.textContent = 'Putting down the needle...';
    } else if (percent >= 100) {
      processingStatus.textContent = 'Vinylfy Complete!';
    }
  }

  /**
   * Simulate progress during processing
   */
  simulateProgress() {
    let progress = 0;
    const interval = setInterval(() => {
      // Increment progress with diminishing speed (slower as it approaches 95%)
      if (progress < 95) {
        const increment = Math.random() * (95 - progress) * 0.1;
        progress = Math.min(95, progress + increment);
        this.updateProgress(progress);
      }
    }, 200);

    return interval;
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

    // Update metadata button state
    this.updateMetadataButtonState();

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

      let { blob, filename } = await api.downloadFile(fileId);

      // If format supports metadata and we have edited metadata, write it to the file
      if (supportsMetadataWriting(this.outputFormat) && this.editedMetadata) {
        try {
          downloadBtn.innerHTML = '<span class="spinner spinner-sm"></span> Adding metadata...';
          console.log(`Writing metadata to ${this.outputFormat.toUpperCase()} file...`);
          blob = await writeMetadata(blob, this.editedMetadata, this.outputFormat);
          showToast('Metadata added to file! 🏷️', 'success');
        } catch (error) {
          console.error('Failed to write metadata:', error);
          showToast('Warning: Failed to add metadata to file', 'warning');
          // Continue with download even if metadata writing fails
        }
      }

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
        this.audioPlayer.hide();  // hide() already pauses the audio
      }

      // Hide results section
      const resultsSection = document.getElementById('resultsSection');
      resultsSection.classList.add('hidden');

      // Clear processed file ID
      this.processedFileId = null;

      // Clear selected file and file input
      this.selectedFile = null;
      const audioFileInput = document.getElementById('audioFile');
      if (audioFileInput) {
        audioFileInput.value = '';
      }

      // Hide file info display
      const fileInfo = document.getElementById('fileInfo');
      if (fileInfo) {
        fileInfo.classList.add('hidden');
      }

      // Reset metadata
      this.originalMetadata = null;
      this.editedMetadata = null;
      this.uploadedArtwork = null;

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
      pop_intensity: 0.6,
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
    // Check if service worker bypass is requested (for debugging mobile issues)
    const urlParams = new URLSearchParams(window.location.search);
    const bypassSW = urlParams.get('no-sw') === 'true';

    if (bypassSW) {
      console.log('🚫 Service Worker bypassed via URL parameter');
      // Unregister existing service workers
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          registrations.forEach(registration => {
            console.log('Unregistering service worker:', registration.scope);
            registration.unregister();
          });
        });
      }
      return; // Don't proceed with PWA setup
    }

    // Register service worker with better error handling
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js')
        .then(registration => {
          console.log('✅ Service Worker registered successfully:', registration.scope);

          // Check for updates every hour
          setInterval(() => {
            registration.update();
          }, 3600000);
        })
        .catch(error => {
          console.error('❌ Service Worker registration failed:', error);
          console.log('App will continue to work without offline support');
          // Don't block the app if SW registration fails
        });
    } else {
      console.log('ℹ️ Service Workers not supported in this browser');
    }

    // Install prompt for Android/Desktop
    const installBtn = document.getElementById('installBtn');

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;

      if (installBtn && !isPWAInstalled()) {
        installBtn.classList.remove('hidden');
      }

      // Show Android install banner
      this.setupAndroidInstallBanner();
    });

    if (installBtn) {
      installBtn.addEventListener('click', async () => {
        if (this.deferredPrompt) {
          this.deferredPrompt.prompt();
          const { outcome } = await this.deferredPrompt.userChoice;
          console.log(`Install prompt outcome: ${outcome}`);
          this.deferredPrompt = null;
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
   * Setup Android install banner
   */
  setupAndroidInstallBanner() {
    // Don't show if user dismissed it or already installed
    if (isPWAInstalled() || localStorage.getItem('vinylfy_android_install_dismissed')) {
      return;
    }

    // Create Android install banner
    const banner = document.createElement('div');
    banner.id = 'androidInstallBanner';
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
          <img src="/assets/icons/android-touch-icon.png" alt="Vinylfy" style="width: 48px; height: 48px; border-radius: 10px; flex-shrink: 0;">
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: var(--font-weight-semibold); margin-bottom: var(--space-xs);">
              Install Vinylfy
            </div>
            <div style="font-size: var(--font-size-sm); opacity: 0.95;">
              Add to your home screen for quick access and offline use
            </div>
          </div>
          <button id="androidInstallAccept" style="
            background: rgba(255,255,255,0.9);
            border: none;
            color: var(--color-primary);
            padding: var(--space-sm) var(--space-md);
            border-radius: var(--radius-md);
            cursor: pointer;
            font-weight: var(--font-weight-semibold);
            font-size: var(--font-size-sm);
            white-space: nowrap;
            flex-shrink: 0;
          ">Install</button>
          <button id="androidInstallClose" style="
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

    // Install button handler
    document.getElementById('androidInstallAccept').addEventListener('click', async () => {
      if (this.deferredPrompt) {
        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;
        console.log(`Android install prompt outcome: ${outcome}`);

        if (outcome === 'accepted') {
          console.log('User accepted the install prompt');
        } else {
          console.log('User dismissed the install prompt');
        }

        // Remove banner after user makes a choice
        banner.remove();
        localStorage.setItem('vinylfy_android_install_dismissed', 'true');
        this.deferredPrompt = null;
      }
    });

    // Close button handler
    document.getElementById('androidInstallClose').addEventListener('click', () => {
      banner.remove();
      localStorage.setItem('vinylfy_android_install_dismissed', 'true');
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
   * Setup product tour with Driver.js
   * Shows on first visit or when app version changes
   */
  setupProductTour() {
    const TOUR_STORAGE_KEY = 'vinylfy_tour_completed';

    // Get stored tour completion data
    const tourData = storage.get(TOUR_STORAGE_KEY);
    const tourCompleted = tourData?.completed;
    const lastTourVersion = tourData?.version;

    // Show tour if:
    // 1. Never completed before (first visit)
    // 2. App version changed since last tour
    const shouldShowTour = !tourCompleted || lastTourVersion !== APP_VERSION;

    if (!shouldShowTour) {
      console.log('ℹ️ Product tour skipped (already completed for this version)');
      return;
    }

    // Small delay to ensure DOM is fully ready
    setTimeout(() => {
      this.startProductTour(APP_VERSION, TOUR_STORAGE_KEY);
    }, 500);
  }

  /**
   * Start the product tour
   */
  startProductTour(appVersion, storageKey) {
    // Check if Driver.js is loaded
    if (typeof window.driver === 'undefined') {
      console.warn('⚠️ Driver.js not loaded, skipping tour');
      return;
    }

    const driverObj = window.driver({
      sanitize: false, // For HTML embeds
      showProgress: true,
      showButtons: ['next', 'previous', 'close'],
      steps: [
        {
          popover: {
            title: 'Welcome to Vinylfy!',
            description: 'Transform your digital audio files into warm, nostalgic vinyl records with authentic vintage effects.',
            side: 'center',
            align: 'center'
          }
        },
        { element: '.theme-toggle-group',
          popover: {
            title: 'Vinylfy Top Area',
            description: 'Vinylfy supports light mode and dark mode. By default, Vinylfy respects your system or browser settings in the Auto mode.', // Show top nav walkthrough video
            side: 'bottom',
            align: 'center'
          }
        },
        {
          element: '#githubLink',
          popover: {
            title: 'Find Vinylfy on Github',
            description: 'Vinylfy is open source, so all vinyl enthusiasts can use and install Vinylfy. Click here to view Vinylfy on Github and see how to install Vinylfy yourself. If you\'re a developer and want to contribute to Vinylfy, you can find more information on Github as well.',
            side: 'bottom',
            align: 'center'
          }
        },
        {
          element: '#healthStatus',
          popover: {
            title: 'Turnable Status',
            description: 'The turntable is the heart of Vinylfy. Check here to make sure the turntable is spinning before proceeding forward. If the turntable is stopped, check with your system administrator.',
            side: 'bottom',
            align: 'center'
          }
        },
        {
          element: '#audioFile',
          popover: {
            title: 'Uploading Your Audio',
            description: 'Start by selecting an audio file. We support WAV, MP3, FLAC, OGG, M4A, and AAC formats. The maximum upload size for files is set by your Vinylfy administrator.',
            side: 'left',
            align: 'start'
          }
        },
        {
          element: '#presetSelector',
          popover: {
            title: 'Choosing Your Vinyl Effect',
            description: 'Select a preset from Vinylfy, including AJW Recommended from Vinylfy\'s own vinyl enthusiast, or choose Custom to fine-tune your track to your preference.',
            side: 'left',
            align: 'center'
          }
        },
        {
          element: '#formatSelector',
          popover: {
            title: 'Select Output Format',
            description: 'Choose your preferred output format. MP3 is most compatible, FLAC is lossless, and AAC offers high quality with smaller file sizes.',
            side: 'right',
            align: 'center'
          }
        },
        {
          element: '#howItWorksBtn',
          popover: {
            title: 'Learn How It Works',
            description: 'Click this button anytime to learn about the vinyl effects being applied to your audio.',
            side: 'right',
            align: 'center'
          }
        },
        {
          element: '#surfaceNose',
          popover: {
            title: 'Vinylfy Switches',
            description: 'Use the Vinylfy switches to enable or disable certain effects.',
            side: 'left',
            align: 'center'
          }
        },
        {
          element: '#noiseintensityGroup',
          popover: {
            title: "Using the sliders ...",
            description: 'Use the sliders to customize your settings for each group. Sliders will disappear for a group if their corresponding switches are off.',
            side: 'top',
            align: 'center'
          }
        },
        {
          element: '#processBtn',
          popover: {
            title: '3. Process Your Audio',
            description: 'Once you\'ve uploaded a file and selected your settings, click here to start the vinylification process!',
            side: 'top',
            align: 'center'
          }
        },
        {
          popover: {
            title: 'You\'re ready to Vinylfy your music!',
            description: 'Start uploading your audio files and give them that authentic vinyl sound. Your files are processed securely and deleted after the amount of time set by your administrator.',
            side: 'center',
            align: 'center'
          }
        }
      ],
      onDestroyStarted: () => {
        // Mark tour as completed when user finishes or closes it
        storage.set(storageKey, {
          completed: true,
          version: appVersion,
          completedAt: new Date().toISOString()
        });
        driverObj.destroy();
      }
    });

    console.log('🎯 Starting product tour...');
    driverObj.drive();
  }

  /**
   * Show processing tour on first use
   */
  showProcessingTour() {
    const PROCESSING_TOUR_KEY = 'vinylfy_processing_tour_shown';

    // Check if tour has already been shown
    if (storage.get(PROCESSING_TOUR_KEY)) {
      return; // Already shown, skip
    }

    // Check if Driver.js is loaded
    if (typeof window.driver === 'undefined') {
      return;
    }

    // Small delay to let processing indicator render
    setTimeout(() => {
      const driverObj = window.driver({
        sanitize: false, // for HTML
        showProgress: true,
        showButtons: ['previous','next', 'close'],
        steps: [
          {
            element: '#resultsSection',
            popover: {
              title: 'Seeing Your Results ...',
              description: 'This section will appear after you begin processing your audio. Let\'s explore some of its key components ...',
              side: 'top',
              align: 'center'
            }
          },
          {
            element: '#processingStatus',
            popover: {
              title: 'Watch Vinylfy Do Its Magic!',
              description: 'Watch the status message change as we analyze your audio, apply vinyl effects, and finalize your track.',
              side: 'left',
              align: 'center'
            }
          },
          {
            element: '.progress-bar-container',
            popover: {
              title: 'Vinylifcation Indicator',
              description: 'The progress bar shows how far along the needle is Vinylfying your audio. Vinylfication typically takes 10-30 seconds depending on file size.',
              side: 'bottom',
              align: 'center'
            }
          },
          {
            element: '#previewBtn',
            popover: {
              title: 'Previewing your Vinylfied audio',
              description: 'Click here to preview you new audio track with vinylification completed. You can play, pause, and move forward or backwards through your track.',
              side: 'left',
              align: 'center'
            }
          },
          {
            element: '#metadataBtn',
            popover: {
              title: 'Don\'t have any metadata, or want to change it? No problem!',
              description: 'Metadata maangement is easy with Vinylfy! Click here to review your file\'s metadata, you can keep it as it is, or add your own metadata including album artwork! Metadata management is only available with AAC, MP3, and FLAC output formats.',
              side: 'bottom',
              align: 'center'
            }
          },
          {
            element: '#downloadBtn',
            popover: {
              title: 'Saving your Vinylfied audio',
              description: 'Click here to download your new vinylfied audio.',
              side: 'bottom',
              align: 'center'
            }
          },
          {
            element: '#discardBtn',
            popover: {
              title: 'Looking for a Remix?',
              description: 'Need to remix your track? Vinylfy has you covered. Press the discard buton to start over again until you get your favorite vinyl sound.',
              side: 'right',
              align: 'center'

            }
          }
        ],
        onDestroyStarted: () => {
          // Mark tour as shown
          storage.set(PROCESSING_TOUR_KEY, true);
          driverObj.destroy();
        }
      });

      console.log('🎬 Starting processing tour...');
      driverObj.drive();
    }, 600); // Delay to ensure progress bar is rendered
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
    document.getElementById('popIntensity').value = this.customSettings.pop_intensity;
    document.getElementById('popIntensityValue').textContent = this.customSettings.pop_intensity.toFixed(2);
    // Hide/show slider groups based on toggle state
    document.getElementById('noiseIntensityGroup').style.display = this.customSettings.surface_noise ? 'block' : 'none';
    document.getElementById('popIntensityGroup').style.display = this.customSettings.surface_noise ? 'block' : 'none';

    document.getElementById('wowFlutter').checked = this.customSettings.wow_flutter;
    document.getElementById('wowFlutterIntensity').value = this.customSettings.wow_flutter_intensity;
    document.getElementById('wowFlutterValue').textContent = this.customSettings.wow_flutter_intensity.toFixed(4);
    // Hide/show slider group based on toggle state
    document.getElementById('wowFlutterIntensityGroup').style.display = this.customSettings.wow_flutter ? 'block' : 'none';

    document.getElementById('harmonicDistortion').checked = this.customSettings.harmonic_distortion;
    document.getElementById('distortionAmount').value = this.customSettings.distortion_amount;
    document.getElementById('distortionValue').textContent = this.customSettings.distortion_amount.toFixed(2);
    // Hide/show slider group based on toggle state
    document.getElementById('distortionAmountGroup').style.display = this.customSettings.harmonic_distortion ? 'block' : 'none';

    document.getElementById('stereoReduction').checked = this.customSettings.stereo_reduction;
    document.getElementById('stereoWidth').value = this.customSettings.stereo_width;
    document.getElementById('stereoWidthValue').textContent = this.customSettings.stereo_width.toFixed(2);
    // Hide/show slider group based on toggle state
    document.getElementById('stereoWidthGroup').style.display = this.customSettings.stereo_reduction ? 'block' : 'none';
  }

  /**
   * Trap focus within modal for keyboard navigation
   */
  trapFocus(modal) {
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
        else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }

      if(e.key === 'Escape') {
        modal.classList.add('hidden');
        this.resetMetadataEditMode();
      }
    });

    firstElement?.focus();
  }
}

// Global diagnostic function for troubleshooting
window.vinylDiagnostics = async function() {
  console.log('🔍 Running Vinylfy diagnostics...\n');

  const results = {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href,
    protocol: window.location.protocol,
    serviceWorker: {},
    cache: {},
    network: {},
    localStorage: {}
  };

  // Check Service Worker
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    results.serviceWorker.supported = true;
    results.serviceWorker.registrations = registrations.length;
    results.serviceWorker.controller = navigator.serviceWorker.controller ? 'Active' : 'None';

    if (registrations.length > 0) {
      results.serviceWorker.scopes = registrations.map(r => r.scope);
      results.serviceWorker.states = registrations.map(r =>
        r.active ? r.active.state : 'No active worker'
      );
    }
  } else {
    results.serviceWorker.supported = false;
  }

  // Check Cache
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    results.cache.supported = true;
    results.cache.cacheNames = cacheNames;
    results.cache.count = cacheNames.length;
  } else {
    results.cache.supported = false;
  }

  // Check localStorage
  try {
    results.localStorage.supported = true;
    results.localStorage.version = localStorage.getItem('vinylfy_version');
    results.localStorage.itemCount = localStorage.length;
  } catch (e) {
    results.localStorage.supported = false;
    results.localStorage.error = e.message;
  }

  // Check network connectivity
  results.network.online = navigator.onLine;
  results.network.connectionType = navigator.connection ? navigator.connection.effectiveType : 'unknown';

  // Test API connection
  try {
    const startTime = Date.now();
    const response = await fetch('/api/health', {
      method: 'GET',
      cache: 'no-store'
    });
    const endTime = Date.now();
    const data = await response.json();

    results.network.apiReachable = true;
    results.network.apiStatus = response.status;
    results.network.apiLatency = `${endTime - startTime}ms`;
    results.network.apiVersion = data.version;
  } catch (error) {
    results.network.apiReachable = false;
    results.network.apiError = error.message;
  }

  // Display results
  console.log('📊 Diagnostic Results:');
  console.log('─────────────────────────────────────');
  console.log(`🌐 Browser: ${results.userAgent}`);
  console.log(`📍 URL: ${results.url}`);
  console.log(`🔒 Protocol: ${results.protocol}`);
  console.log(`\n🔧 Service Worker:`);
  console.log(`   Supported: ${results.serviceWorker.supported}`);
  if (results.serviceWorker.supported) {
    console.log(`   Active: ${results.serviceWorker.controller}`);
    console.log(`   Registrations: ${results.serviceWorker.registrations}`);
    if (results.serviceWorker.scopes) {
      console.log(`   Scopes: ${results.serviceWorker.scopes.join(', ')}`);
    }
  }
  console.log(`\n💾 Cache:`);
  console.log(`   Supported: ${results.cache.supported}`);
  if (results.cache.supported) {
    console.log(`   Active Caches: ${results.cache.count}`);
    console.log(`   Names: ${results.cache.cacheNames.join(', ')}`);
  }
  console.log(`\n🌍 Network:`);
  console.log(`   Online: ${results.network.online}`);
  console.log(`   Connection: ${results.network.connectionType}`);
  console.log(`   API Reachable: ${results.network.apiReachable}`);
  if (results.network.apiReachable) {
    console.log(`   API Status: ${results.network.apiStatus}`);
    console.log(`   API Latency: ${results.network.apiLatency}`);
    console.log(`   Server Version: ${results.network.apiVersion}`);
  } else {
    console.log(`   API Error: ${results.network.apiError}`);
  }
  console.log(`\n💿 localStorage:`);
  console.log(`   Supported: ${results.localStorage.supported}`);
  if (results.localStorage.supported) {
    console.log(`   Stored Version: ${results.localStorage.version || 'Not set'}`);
    console.log(`   Items: ${results.localStorage.itemCount}`);
  }
  console.log('─────────────────────────────────────');
  console.log('\n💡 Tips:');
  console.log('   • To bypass service worker: Add ?no-sw=true to URL');
  console.log('   • To clear cache: window.vinylClearCache()');
  console.log('   • For help: See TROUBLESHOOTING.md');
  console.log('\n📋 Full results object available as: window.lastDiagnostics');

  window.lastDiagnostics = results;
  return results;
};

// Global cache clearing function
window.vinylClearCache = async function() {
  console.log('🧹 Clearing all Vinylfy caches and service workers...');

  try {
    // Clear caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      console.log('✅ All caches cleared');
    }

    // Unregister service workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
      console.log('✅ All service workers unregistered');
    }

    // Clear localStorage
    localStorage.removeItem('vinylfy_version');
    console.log('✅ localStorage cleared');

    console.log('\n🔄 Please reload the page for changes to take effect');
    console.log('   Run: location.reload(true)');

    return { success: true };
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
    return { success: false, error: error.message };
  }
};

console.log('🎵 Vinylfy loaded!');
console.log('💡 Available commands:');
console.log('   • vinylDiagnostics() - Run connection diagnostics');
console.log('   • vinylClearCache() - Clear all caches and service workers');

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new VinylApp();
  });
} else {
  new VinylApp();
}

export default VinylApp;