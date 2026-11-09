import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores(["dist", "coverage", "playwright-report", "test-results", "node_modules"]),

  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "no-console": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: "dangerouslySetInnerHTML is not allowed.",
        },
      ],
    },
  },

  // Application code (browser).
  {
    files: ["src/**/*.{ts,tsx}"],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: { globals: globals.browser },
  },

  // shadcn/ui components are generated vendor-style code and export variant helpers next to components.
  {
    files: ["src/shared/components/ui/**/*.{ts,tsx}"],
    rules: { "react-refresh/only-export-components": "off" },
  },

  // Unit / component tests: console output and loose typing of mocks are acceptable here.
  {
    files: ["src/**/*.test.{ts,tsx}", "src/test/**/*.{ts,tsx}"],
    rules: {
      "no-console": "off",
      "react-refresh/only-export-components": "off",
    },
  },

  // Domain code must stay pure: no React, no DOM.
  {
    files: ["src/domain/**/*.ts"],
    languageOptions: { globals: { ...globals.es2025 } },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "react",
            "react-dom",
            "react/*",
            "react-dom/*",
            "@/app/*",
            "@/pages/*",
            "@/widgets/*",
            "@/shared/components/*",
            "@/shared/hooks/*",
          ],
        },
      ],
    },
  },

  // Playwright specs and Node-side config files.
  {
    files: ["e2e/**/*.ts", "vite.config.ts", "playwright.config.ts"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["e2e/**/*.ts"],
    rules: { "no-console": "off" },
  },

  // Plain JavaScript files are not part of any tsconfig: lint them without type information.
  {
    files: ["**/*.{js,mjs,cjs}"],
    extends: [js.configs.recommended, tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
  {
    // Classic browser script (not a module): runs before the app bundle loads.
    files: ["public/**/*.js"],
    languageOptions: { sourceType: "script", globals: globals.browser },
  },
]);
