import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Builda pra ../sidebar (a pasta que o manifest.json / content.js já
// referenciam como iframe da sidebar). Fonte fica em sidebar-src/, build
// final sobrescreve sidebar/index.html + sidebar/assets/*.
export default defineConfig({
  plugins: [react()],
  base: './', // caminhos relativos — a extensão não roda a partir da raiz de um domínio
  build: {
    outDir: '../sidebar',
    assetsDir: 'assets',
    // sidebar/ é 100% gerada pelo build (index.html + assets/) — precisa
    // limpar antes, senão o Vite acumula JS/CSS antigos a cada build (o
    // nome do arquivo muda por causa do hash no nome).
    emptyOutDir: true,
  },
})
