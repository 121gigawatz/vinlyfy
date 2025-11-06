/**
 * Utility functions for Vinylfy
 */

// Format file size to human-readable format
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

// Format time in seconds to MM:SS
export function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Validate audio file
export function isValidAudioFile(file) {
  const validTypes = [
    'audio/wav',
    'audio/wave',
    'audio/x-wav',
    'audio/mpeg',
    'audio/mp3',
    'audio/flac',
    'audio/ogg',
    'audio/m4a',
    'audio/x-m4a',
    'audio/aac'
  ];
  
  const validExtensions = ['wav', 'mp3', 'flac', 'ogg', 'm4a', 'aac'];
  
  // Check MIME type
  if (validTypes.includes(file.type)) {
    return true;
  }
  
  // Fallback: check extension
  const ext = file.name.split('.').pop().toLowerCase();
  return validExtensions.includes(ext);
}

// Get file extension
export function getFileExtension(filename) {
  return filename.split('.').pop().toLowerCase();
}

// Debounce function
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Throttle function
export function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Show toast notification
export function showToast(message, type = 'info', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    padding: 1rem 1.5rem;
    background: var(--color-bg-elevated);
    color: var(--color-text-primary);
    border-left: 4px solid var(--color-${type === 'error' ? 'error' : type === 'success' ? 'success' : 'primary'});
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    z-index: var(--z-tooltip);
    animation: slideUp 0.3s ease-out;
    max-width: 400px;
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Copy to clipboard
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!', 'success');
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    showToast('Failed to copy to clipboard', 'error');
    return false;
  }
}

// Download file from blob
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Check if device is mobile
export function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

// Check if device supports touch
export function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

// Get device type
export function getDeviceType() {
  const ua = navigator.userAgent;
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'tablet';
  }
  if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
}

// Local storage helpers with error handling
export const storage = {
  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error('Storage get error:', error);
      return defaultValue;
    }
  },
  
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Storage set error:', error);
      return false;
    }
  },
  
  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Storage remove error:', error);
      return false;
    }
  },
  
  clear() {
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.error('Storage clear error:', error);
      return false;
    }
  }
};

// Generate unique ID
export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Sleep/delay function
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Get query parameters
export function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  const result = {};
  for (const [key, value] of params) {
    result[key] = value;
  }
  return result;
}

// Update query parameters without reload
export function updateQueryParams(params) {
  const url = new URL(window.location);
  Object.keys(params).forEach(key => {
    if (params[key] === null || params[key] === undefined) {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, params[key]);
    }
  });
  window.history.pushState({}, '', url);
}

// Check if PWA is installed
export function isPWAInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true;
}

// Request notification permission
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return false;
  }
  
  if (Notification.permission === 'granted') {
    return true;
  }
  
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  
  return false;
}

// Show notification
export function showNotification(title, options = {}) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }
  
  const notification = new Notification(title, {
    icon: '/assets/icons/icon-192x192.png',
    badge: '/assets/icons/icon-72x72.png',
    ...options
  });
  
  return notification;
}

// Validate settings
export function validateSettings(settings) {
  const errors = [];
  
  if (settings.noise_intensity < 0 || settings.noise_intensity > 0.1) {
    errors.push('Noise intensity must be between 0 and 0.1');
  }
  
  if (settings.wow_flutter_intensity < 0 || settings.wow_flutter_intensity > 0.01) {
    errors.push('Wow/Flutter intensity must be between 0 and 0.01');
  }
  
  if (settings.distortion_amount < 0 || settings.distortion_amount > 1.0) {
    errors.push('Distortion amount must be between 0 and 1.0');
  }
  
  if (settings.stereo_width < 0 || settings.stereo_width > 1.0) {
    errors.push('Stereo width must be between 0 and 1.0');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// Format preset name for display
export function formatPresetName(preset) {
  return preset.charAt(0).toUpperCase() + preset.slice(1);
}

// Parse error message from API response
export function parseErrorMessage(error) {
  if (typeof error === 'string') {
    return error;
  }
  
  if (error.response && error.response.data && error.response.data.error) {
    return error.response.data.error;
  }
  
  if (error.message) {
    return error.message;
  }
  
  return 'An unknown error occurred';
}

// Add CSS animation keyframes dynamically
export function addKeyframes(name, rules) {
  const styleSheet = document.styleSheets[0];
  const keyframes = `@keyframes ${name} { ${rules} }`;
  styleSheet.insertRule(keyframes, styleSheet.cssRules.length);
}

// Detect if user prefers reduced motion
export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}