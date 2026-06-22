import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Loyiha OneDrive ichida — OneDrive sinxronlashda fayllarni (DXF/ vaqtinchalik
    // fayllari, public/brand/ rasmlar va h.k.) qulflab qo'yadi. Native fayl
    // kuzatuvchisi (fs.watch) bunda EBUSY bilan butun dev serverni yiqitadi.
    // Shu sabab POLLING rejimiga o'tamiz — u qulflangan faylni stat qilib kuzatadi,
    // EBUSY bermaydi (HMR ishlayveradi). Og'ir/keraksiz papkalar e'tiborsiz qoldiriladi.
    watch: {
      usePolling: true,
      interval: 300,
      ignored: ['**/DXF/**', '**/*.dwl', '**/*.dwl2', '**/*.tmp', '**/public/brand/**'],
    },
  },
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
