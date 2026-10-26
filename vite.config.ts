import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"
import { imagetools } from "vite-imagetools"

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")

  return {
    // imagetools: `?w=…&format=…` on an image import builds resized
    // AVIF/WebP copies at build time (see the banner in PublicHeader).
    plugins: [react(), tailwindcss(), imagetools()],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
      },
    },
    server: {
      // In development the app calls `/api` on its own origin and Vite passes
      // it to upasana-be. Same-origin means the session cookie needs no
      // cross-site handling, and it is what makes the app work from a phone
      // on the same Wi-Fi (`pnpm dev --host`): the phone cannot reach
      // "localhost:5000", but it can reach this dev server.
      proxy: {
        "/api": {
          target: env.API_PROXY_TARGET || "http://localhost:5000",
          changeOrigin: false,
        },
      },
    },
  }
})
