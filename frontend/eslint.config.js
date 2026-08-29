import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      complexity: ["error", 15],
      "max-depth": ["error", 4],
      // Provider + hook colocation is the standard React context pattern.
      // Hook names listed here are the only non-component exports allowed
      // from a component file; CVA variants must stay unexported.
      "react-refresh/only-export-components": [
        "error",
        {
          allowConstantExport: true,
          allowExportNames: [
            "useTheme",
            "useAuth",
            "useToast",
            "useBackground",
            "useShell",
          ],
        },
      ],
    },
  },
])
