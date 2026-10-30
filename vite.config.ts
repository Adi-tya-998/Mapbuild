import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const isGitHubPages = loadEnv(mode, '.', '').GITHUB_PAGES === 'true';

  return {
    base: isGitHubPages ? '/Mapbuild/' : '/',
    plugins: [react()],
  };
});
