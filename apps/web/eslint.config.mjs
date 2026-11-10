import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // The codebase intentionally syncs local form/dialog state from props/queries in effects
      // (reset-on-open, hydrate-from-storage); flagged ~50x and rewriting it is out of scope.
      "react-hooks/set-state-in-effect": "warn",
      // Allow `_`-prefixed names for deliberately unused args/destructured props.
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true }],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "coverage/**", "playwright-report/**", "test-results/**", "next-env.d.ts"]),
]);
