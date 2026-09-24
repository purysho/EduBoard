import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@main': resolve('src/main')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  renderer: {
    // Pin the dev server to one explicit IPv4 address and one port. electron-vite hands
    // Electron a URL built from these *configured* values, so they must match what the
    // server actually binds:
    // - host: Vite's default "localhost" binds only the first address Node's DNS returns,
    //   which on Windows (Node 17+) is the IPv6 loopback ::1 — so any client dialing
    //   127.0.0.1 is refused. An explicit IPv4 address binds and advertises the same thing.
    // - strictPort: without it, a leftover dev server still holding 5173 makes Vite
    //   silently move to 5174 while Electron is still told 5173. Failing fast with
    //   "Port 5173 is already in use" points straight at the stale process instead.
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true
    },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
