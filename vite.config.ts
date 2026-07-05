import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    allowedHosts: ['alfred.local', '.local']
  },
  test: {
    include: ['tests/**/*.{test,spec}.{js,ts}']
  }
});
