import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 1Click API has no CORS for browsers; proxy in dev. The workflow
      // engine owns these calls server-side in production.
      "/1click": {
        target: "https://1click.chaindefuser.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/1click/, ""),
      },
    },
  },
});
