/**
 * Audio Player Component for Vinylfy
 * Handles audio preview playback with custom controls
 */

import { formatTime } from './utils.js';

export class AudioPlayer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.audio = null;
    this.isPlaying = false;
    this.currentTime = 0;
    this.duration = 0;
    
    this.render();
    this.attachEventListeners();
  }

  /**
   * Render the audio player UI
   */
  render() {
    this.container.innerHTML = `
      <div class="audio-player" id="audioPlayerContainer">
        <div class="audio-controls">
          <button class="audio-play-btn" id="playBtn" aria-label="Play">
            ▶
          </button>
          <div class="audio-timeline" id="timeline">
            <div class="audio-progress" id="progress"></div>
          </div>
        </div>
        <div class="audio-time">
          <span id="currentTime">0:00</span>
          <span id="duration">0:00</span>
        </div>
      </div>
    `;

    // Get references to elements
    this.playBtn = document.getElementById('playBtn');
    this.timeline = document.getElementById('timeline');
    this.progress = document.getElementById('progress');
    this.currentTimeEl = document.getElementById('currentTime');
    this.durationEl = document.getElementById('duration');
    this.playerContainer = document.getElementById('audioPlayerContainer');
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Play/Pause button
    this.playBtn.addEventListener('click', () => this.togglePlay());

    // Timeline click to seek
    this.timeline.addEventListener('click', (e) => this.seek(e));

    // Keyboard controls
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && this.audio && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        this.togglePlay();
      }
    });
  }

  /**
   * Load an audio file
   */
  load(url) {
    // Clean up existing audio
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.removeAudioListeners();
    }

    // Create new audio element
    this.audio = new Audio(url);
    this.audio.preload = 'metadata';

    // Add audio event listeners
    this.audio.addEventListener('loadedmetadata', () => {
      this.duration = this.audio.duration;
      this.durationEl.textContent = formatTime(this.duration);
    });

    this.audio.addEventListener('timeupdate', () => {
      this.currentTime = this.audio.currentTime;
      this.updateProgress();
    });

    this.audio.addEventListener('ended', () => {
      this.isPlaying = false;
      this.updatePlayButton();
      this.audio.currentTime = 0;
    });

    this.audio.addEventListener('error', (e) => {
      console.error('Audio playback error:', e);
      this.showError('Failed to load audio');
    });

    // Show player
    this.show();
  }

  /**
   * Toggle play/pause
   */
  async togglePlay() {
    if (!this.audio) return;

    try {
      if (this.isPlaying) {
        this.audio.pause();
        this.isPlaying = false;
      } else {
        await this.audio.play();
        this.isPlaying = true;
      }
      this.updatePlayButton();
    } catch (error) {
      console.error('Playback error:', error);
      this.showError('Playback failed');
    }
  }

  /**
   * Seek to a position
   */
  seek(e) {
    if (!this.audio || !this.duration) return;

    const rect = this.timeline.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const time = percent * this.duration;
    
    this.audio.currentTime = Math.max(0, Math.min(time, this.duration));
  }

  /**
   * Update progress bar
   */
  updateProgress() {
    if (!this.duration) return;

    const percent = (this.currentTime / this.duration) * 100;
    this.progress.style.width = `${percent}%`;
    this.currentTimeEl.textContent = formatTime(this.currentTime);
  }

  /**
   * Update play button appearance
   */
  updatePlayButton() {
    this.playBtn.textContent = this.isPlaying ? '⏸' : '▶';
    this.playBtn.setAttribute('aria-label', this.isPlaying ? 'Pause' : 'Play');
  }

  /**
   * Show the player
   */
  show() {
    this.container.classList.remove('hidden');
    this.playerContainer.classList.add('animate-fadeIn');
  }

  /**
   * Hide the player
   */
  hide() {
    this.container.classList.add('hidden');
    if (this.audio) {
      this.audio.pause();
      this.isPlaying = false;
      this.updatePlayButton();
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-error';
    errorDiv.textContent = message;
    this.playerContainer.appendChild(errorDiv);

    setTimeout(() => errorDiv.remove(), 3000);
  }

  /**
   * Remove audio event listeners
   */
  removeAudioListeners() {
    if (this.audio) {
      this.audio.removeEventListener('loadedmetadata', () => {});
      this.audio.removeEventListener('timeupdate', () => {});
      this.audio.removeEventListener('ended', () => {});
      this.audio.removeEventListener('error', () => {});
    }
  }

  /**
   * Clean up and destroy the player
   */
  destroy() {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.removeAudioListeners();
      this.audio = null;
    }
    this.container.innerHTML = '';
  }

  /**
   * Get current playback state
   */
  getState() {
    return {
      isPlaying: this.isPlaying,
      currentTime: this.currentTime,
      duration: this.duration,
      loaded: this.audio !== null
    };
  }

  /**
   * Set volume (0.0 to 1.0)
   */
  setVolume(volume) {
    if (this.audio) {
      this.audio.volume = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Get current volume
   */
  getVolume() {
    return this.audio ? this.audio.volume : 1.0;
  }

  /**
   * Mute/unmute
   */
  toggleMute() {
    if (this.audio) {
      this.audio.muted = !this.audio.muted;
      return this.audio.muted;
    }
    return false;
  }

  /**
   * Skip forward/backward
   */
  skip(seconds) {
    if (this.audio && this.duration) {
      this.audio.currentTime = Math.max(0, Math.min(this.currentTime + seconds, this.duration));
    }
  }
}

export default AudioPlayer;