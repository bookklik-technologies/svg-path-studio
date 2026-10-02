import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2022'
  },
  test: {
    environment: 'node'
  }
});
