import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

const isDev = process.env.NODE_ENV !== 'production'

// Builda pra ../sidebar (a pasta que o manifest.json / content.js já
// referenciam como iframe da sidebar). Fonte fica em sidebar-src/, build
// final sobrescreve sidebar/index.html + sidebar/assets/*.
export default defineConfig({
  plugins: [
    react(),
    // HTTPS obrigatório em dev: o sidebar roda como iframe dentro de
    // https://web.whatsapp.com — sem HTTPS o Chrome bloqueia por mixed content.
    ...(isDev ? [basicSsl()] : []),
  ],
  base: isDev ? '/' : './',
  server: {
    headers: {
      'X-Frame-Options': 'ALLOWALL',
      'Content-Security-Policy': '',
    },
    cors: true,
  },
  build: {
    outDir: '../sidebar',
    assetsDir: 'assets',
    emptyOutDir: true,
  },
})
