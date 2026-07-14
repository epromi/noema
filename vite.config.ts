import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    allowedHosts: ['alfred.local', 'noema.local', '.local', 'promisnotebook.tail117b73.ts.net', '.ts.net']
  },
  test: {
    include: ['tests/**/*.{test,spec}.{js,ts}']
  }
});
