// ============================================================
//  KIRISH EKRANI — login/parol SERVERDA tekshiriladi
//  onLogin async: {ok, xabar} qaytaradi (xabar — xato matni)
// ============================================================
import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';

export function LoginScreen({ onLogin, shopName = 'Zafarjon Payariq metall' }) {
  const [loginVal, setLoginVal] = useState('');
  const [parol, setParol] = useState('');
  const [xato, setXato] = useState('');
  const [yuklanmoqda, setYuklanmoqda] = useState(false);

  async function kirish(e) {
    e.preventDefault();
    if (yuklanmoqda) return;
    setXato('');
    setYuklanmoqda(true);
    try {
      const nat = await onLogin(loginVal, parol);
      if (!nat?.ok) setXato(nat?.xabar || 'Login yoki parol noto\'g\'ri.');
    } catch (err) {
      setXato('Kirishda xatolik — qayta urinib ko\'ring.');
    } finally {
      setYuklanmoqda(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-app">
      <form onSubmit={kirish} className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 space-y-4">
        <div className="text-center">
          <img src="/icon-512.png" alt="Logo"
            className="w-20 h-20 mx-auto mb-3 rounded-2xl shadow-lg shadow-slate-900/25 anim-logo-in" />
          <h1 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Georgia, serif' }}>{shopName}</h1>
          <p className="text-xs text-slate-500">Kirish uchun login va parolni kiriting</p>
        </div>

        <div>
          <label className="block text-xs text-slate-600 mb-1 font-medium">Login</label>
          <input value={loginVal} onChange={(e) => setLoginVal(e.target.value)} autoComplete="username"
            disabled={yuklanmoqda}
            className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-lg focus:border-slate-900 outline-none disabled:opacity-60" />
        </div>
        <div>
          <label className="block text-xs text-slate-600 mb-1 font-medium">Parol</label>
          <input type="password" value={parol} onChange={(e) => setParol(e.target.value)} autoComplete="current-password"
            disabled={yuklanmoqda}
            className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-lg focus:border-slate-900 outline-none disabled:opacity-60" />
        </div>

        {xato && <p className="text-sm text-red-600">{xato}</p>}

        <button type="submit" disabled={yuklanmoqda}
          className="w-full py-3 rounded-lg bg-slate-900 text-white font-bold hover:bg-slate-800 disabled:opacity-70 flex items-center justify-center gap-2">
          {yuklanmoqda ? (<><Loader2 className="w-4 h-4 animate-spin" /> Tekshirilmoqda...</>) : 'Kirish'}
        </button>
      </form>
    </div>
  );
}
