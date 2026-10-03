// Centralized API and Socket URL resolver for Web and Capacitor Native Android APK

export const getApiBaseUrl = () => {
  // Check if running in Capacitor Native Environment
  if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) {
    return import.meta.env.VITE_API_URL || 'https://exambattle-app.onrender.com';
  }
  // Standard Web / Vite fallback
  return import.meta.env.VITE_API_URL || '';
};

export const getSocketUrl = () => {
  // Check if running in Capacitor Native Environment
  if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) {
    return import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || 'https://exambattle-app.onrender.com';
  }
  // Standard Web fallback
  return window.location.hostname === 'localhost' ? 'http://localhost:5000' : window.location.origin;
};
