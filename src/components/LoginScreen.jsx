// ============================================================
//  KIRISH EKRANI (lokal login/parol)
// ============================================================
import React, { useState } from 'react';
import { Lock } from 'lucide-react';

export function LoginScreen({ onLogin }) {
  const [loginVal, setLoginVal] = useState('');
  const [parol, setParol] = useState('');
  const [xato, setXato] = useState('');

  function kirish(e) {
    e.preventDefault();
    const ok = onLogin(loginVal, parol);
    if (!ok) setXato('Login yoki parol noto\'g\'ri.');
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-app">
      <form onSubmit={kirish} className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 space-y-4">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-slate-900 flex items-center justify-center mb-2">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Georgia, serif' }}>Tunika</h1>
          <p className="text-xs text-slate-500">Kirish uchun login va parolni kiriting</p>
        </div>

        <div>
          <label className="block text-xs text-slate-600 mb-1 font-medium">Login</label>
          <input value={loginVal} onChange={(e) => setLoginVal(e.target.value)} autoComplete="username"
            className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-lg focus:border-slate-900 outline-none" />
        </div>
        <div>
          <label className="block text-xs text-slate-600 mb-1 font-medium">Parol</label>
          <input type="password" value={parol} onChange={(e) => setParol(e.target.value)} autoComplete="current-password"
            className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-lg focus:border-slate-900 outline-none" />
        </div>

        {xato && <p className="text-sm text-red-600">{xato}</p>}

        <button type="submit"
          className="w-full py-3 rounded-lg bg-slate-900 text-white font-bold hover:bg-slate-800">
          Kirish
        </button>
      </form>
    </div>
  );
}
