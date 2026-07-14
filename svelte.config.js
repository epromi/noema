import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter(),
    csrf: {
      trustedOrigins: ['alfred.local', '192.168.0.231', '100.91.60.103', 'promisnotebook.tail117b73.ts.net', '.ts.net']
    }
  },
  vite: {
    server: {
      allowedHosts: ['alfred.local', '.local', '192.168.0.231', 'promisnotebook.tail117b73.ts.net', '.ts.net']
    }
  }
};

export default config;
