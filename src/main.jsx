import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { InstallPrompt } from './components/InstallPrompt.jsx';
import { ZakasHolat } from './ommaviy/ZakasHolat.jsx';
import './index.css';

// Ommaviy (loginsiz) sahifa: /z/<token> — mijoz chekdagi QR orqali kiradi va
// faqat O'Z zakasining holatini ko'radi. Ilovaning qolgan qismi yuklanmaydi.
const yol = typeof window !== 'undefined' ? window.location.pathname : '';
const zakasToken = yol.startsWith('/z/') ? decodeURIComponent(yol.slice(3).replace(/\/+$/, '')) : '';

ReactDOM.createRoot(document.getElementById('root')).render(
  zakasToken ? (
    <React.StrictMode>
      <ZakasHolat token={zakasToken} />
    </React.StrictMode>
  ) : (
    <React.StrictMode>
      <App />
      <InstallPrompt />
    </React.StrictMode>
  )
);

// Service worker — offline rejim (faqat ishlab chiqarish/prod build'da)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // Yangi SW boshqaruvni olganda sahifani BIR MARTA avtomatik yangilaymiz —
  // shunda eski kesh hech qachon eski kodni ushlab turmaydi (qo'lda Ctrl+Shift+R shart emas).
  // Birinchi o'rnatishda (sahifa hali controller'siz — clients.claim) reload qilmaymiz,
  // aks holda foydalanuvchi forma to'ldirayotganda sahifa yangilanib ketadi.
  let reloaded = false;
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) { hadController = true; return; }
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
