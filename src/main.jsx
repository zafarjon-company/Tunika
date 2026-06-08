import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { InstallPrompt } from './components/InstallPrompt.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <InstallPrompt />
  </React.StrictMode>
);

// Service worker — offline rejim (faqat ishlab chiqarish/prod build'da)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* noop */ });
  });
}
