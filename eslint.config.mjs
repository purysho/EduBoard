import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'
import js from '@eslint/js'
import globals from 'globals'

export default defineConfig(
  { ignores: ['**/node_modules', '**/dist', '**/out'] },
  // portal/ is a separate, standalone Node service: plain CommonJS JavaScript, no build
  // step and no TypeScript. It gets plain-JS rules of its own rather than the app's
  // TS/React ones, but it is linted: it's the internet-facing half of the product.
  {
    files: ['portal/**/*.js'],
    ...js.configs.recommended,
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.node } }
  },
  {
    files: ['portal/public/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: { ...globals.serviceworker, ...globals.browser }
    }
  },
  {
    files: ['portal/**/*.js'],
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }]
    }
  },
  {
    ...tseslint.configs.recommended[0],
    ignores: ['portal/**']
  },
  ...tseslint.configs.recommended.slice(1).map((c) => ({ ...c, ignores: ['portal/**'] })),
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
