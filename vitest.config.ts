import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@main': resolve(__dirname, 'src/main'),
      // The tests never start Electron; see the stub for why they don't load the real one.
      electron: resolve(__dirname, 'tools/test/electron-stub.ts')
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
})
