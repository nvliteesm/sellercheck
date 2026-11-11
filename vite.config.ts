/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Reuse the production headers from vercel.json so `npm run preview`
// enforces the same Content Security Policy as the deployed site.
type VercelConfig = { headers: { source: string; headers: { key: string; value: string }[] }[] }
const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')) as VercelConfig
const productionHeaders = Object.fromEntries(
  (vercel.headers[0]?.headers ?? []).map(({ key, value }) => [key, value]),
)

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Keep the build free of inline scripts so `script-src 'self'` holds.
    modulePreload: { polyfill: false },
    sourcemap: false,
  },
  worker: {
    format: 'es',
  },
  preview: {
    headers: productionHeaders,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
})
