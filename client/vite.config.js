import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:3030',
      '/ws': {
        target: 'ws://localhost:3030',
        ws: true,
      },
    },
  },
});
