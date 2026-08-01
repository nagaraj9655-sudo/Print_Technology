import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Read PORT from the environment without pulling in @types/node.
const envPort = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.PORT

export default defineConfig({
  plugins: [react()],
  server: {
    port: envPort ? Number(envPort) : 5173,
    strictPort: false,
  },
})
