import { defineConfig, globalIgnores } from 'eslint/config'
import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import neostandard from 'neostandard'

const neostandardConfig = neostandard().map((config) => ({ ...config, files: ['**/*.js', '**/*.ts', '**/*.mjs', '**/*.cjs', '**/*.jsx'] }))

export default defineConfig([
  eslint.configs.recommended,
  ...neostandardConfig,
  tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.ts'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
    }
  },
  {
    files: ['**/*.spec.ts', '**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off'
    }
  },
  globalIgnores([
    'dist/',
    'node_modules/',
    '.serverless/',
  ]),
])
