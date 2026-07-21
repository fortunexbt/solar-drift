import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative assets keep the production bundle portable across project Pages URLs.
  base: './',
  server: {
    open: false
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
});
