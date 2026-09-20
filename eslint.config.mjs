import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'

export default defineConfig(
  // portal/ is a separate, standalone Node service (plain CommonJS, no build step, no
  // relation to this app's TS/React source) — see portal/README.md. Its own lint
  // conventions don't belong here.
  { ignores: ['**/node_modules', '**/dist', '**/out', 'portal/**'] },
  tseslint.configs.recommended,
  eslintPluginReact.configs.flat.recommended,
  eslintPluginReact.configs.flat['jsx-runtime'],
  {
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': eslintPluginReactHooks,
      'react-refresh': eslintPluginReactRefresh
    },
    rules: {
      ...eslintPluginReactHooks.configs.recommended.rules,
      ...eslintPluginReactRefresh.configs.vite.rules
    }
  },
  {
    // React Query hook wrappers: inferring each hook's UseQueryResult/UseMutationResult
    // type is the idiomatic pattern here (spelling it out ~40 times over adds noise, not
    // safety, since the wrapped api.* calls are already fully typed).
    files: ['src/renderer/src/lib/queries.ts'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off'
    }
  },
  eslintConfigPrettier
)
