import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { getApiBaseUrl } from './lib/apiConfig';

// Global fetch interceptor to support Capacitor Native Android relative path resolution
const originalFetch = window.fetch;
window.fetch = function (resource, config) {
  if (typeof resource === 'string' && resource.startsWith('/api')) {
    const baseUrl = getApiBaseUrl();
    if (baseUrl) {
      resource = `${baseUrl}${resource}`;
    }
  }
  return originalFetch(resource, config);
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
