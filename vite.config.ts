import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  // Config PÚBLICA do Supabase (URL + anon key) injetada no bundle do /admin.
  // A anon key é pública por design (protegida por RLS). A service_role NUNCA
  // é exposta aqui. Lê de process.env (Vercel) com fallback para .env.local.
  const fileEnv = loadEnv(mode, process.cwd(), '');
  const SUPABASE_URL = process.env.SUPABASE_URL || fileEnv.SUPABASE_URL || '';
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || fileEnv.SUPABASE_ANON_KEY || '';

  return {
    define: {
      __SUPABASE_URL__: JSON.stringify(SUPABASE_URL),
      __SUPABASE_ANON_KEY__: JSON.stringify(SUPABASE_ANON_KEY),
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
