import { defineConfig } from 'vite';

// Relative asset paths so the build works from any subpath, such as
// GitHub Pages at /music-art/.
export default defineConfig({
  base: './',
});
