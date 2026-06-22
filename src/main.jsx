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
  // Yangi SW boshqaruvni olganda sahifani BIR MARTA avtomatik yangilaymiz —
  // shunda eski kesh hech qachon eski kodni ushlab turmaydi (qo'lda Ctrl+Shift+R shart emas).
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      // Har ochilishda yangi versiyani tekshiramiz
      try { reg.update(); } catch (e) { /* noop */ }
    }).catch(() => { /* noop */ });
  });
}
