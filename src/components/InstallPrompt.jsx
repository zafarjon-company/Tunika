// ============================================================
//  ILOVANI O'RNATISH (PWA install) — kichik banner
// ------------------------------------------------------------
//  `beforeinstallprompt` hodisasini ushlaydi va pastki chap
//  burchakda "O'rnatish" tugmasini ko'rsatadi. Foydalanuvchi
//  yopsa yoki o'rnatsa — boshqa ko'rinmaydi (localStorage).
//  iOS Safari'da hodisa yo'q — banner chiqmaydi (u yerda "Share →
//  Bosh ekranga qo'shish" orqali o'rnatiladi).
// ============================================================
import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

export function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Allaqachon o'rnatilgan (standalone) yoki avval yopilgan bo'lsa — ko'rsatmaymiz
    const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches
      || window.navigator.standalone === true;
    let dismissed = false;
    try { dismissed = localStorage.getItem('pwa-install-dismissed') === '1'; } catch (e) { /* noop */ }
    if (standalone || dismissed) return undefined;

    function onPrompt(e) {
      e.preventDefault();
      setDeferred(e);
      setShow(true);
    }
    function onInstalled() {
      setShow(false);
      try { localStorage.setItem('pwa-install-dismissed', '1'); } catch (e) { /* noop */ }
    }
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  function install() {
    if (!deferred) return;
    deferred.prompt();
    deferred.userChoice?.finally?.(() => { setShow(false); setDeferred(null); });
  }
  function dismiss() {
    setShow(false);
    try { localStorage.setItem('pwa-install-dismissed', '1'); } catch (e) { /* noop */ }
  }

  if (!show) return null;
  return (
    <div className="fixed bottom-4 left-4 z-40 no-print anim-toast max-w-[calc(100vw-2rem)]">
      <div className="flex items-center gap-3 bg-white border-2 border-slate-900 rounded-xl shadow-2xl pl-3 pr-2 py-2">
        <span className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center flex-shrink-0">
          <Download className="w-4 h-4" />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-900 leading-tight">Ilovani o'rnatish</div>
          <div className="text-[11px] text-slate-500 leading-tight">Telefon/kompyuterga ilova qilib qo'ying</div>
        </div>
        <button onClick={install}
          className="ml-1 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 flex-shrink-0">
          O'rnatish
        </button>
        <button onClick={dismiss} aria-label="Yopish" className="text-slate-400 hover:text-slate-700 p-1 flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
