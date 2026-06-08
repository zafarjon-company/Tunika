import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Firebase ~544 KB — uni alohida chunk qilamiz (bo'lib bo'lmaydi), shu sabab chegarani ko'taramiz.
    chunkSizeWarningLimit: 600,
    // Firebase va React'ni alohida "chunk"larga ajratamiz — asosiy
    // bundle kichrayadi, brauzer keshlash yaxshilanadi.
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/firestore', 'firebase/auth'],
          'react-vendor': ['react', 'react-dom'],
        },
      },
    },
  },
});
