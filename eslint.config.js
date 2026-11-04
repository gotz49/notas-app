// ============================================================
//  ESLint: revisa el codigo en busca de errores comunes.
//  Correr con: npm run lint
//  - @eslint/js + typescript-eslint: reglas generales de JS/TS
//  - react-hooks: las dos reglas clasicas de los hooks de React
//    (no llamar hooks dentro de ifs; dependencias de useEffect).
//    Las reglas nuevas del "React Compiler" no estan activadas: el
//    codigo no se escribio pensando en ellas y no aportan para esta app.
// ============================================================
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist", "coverage", "node_modules", "public/sw.js", "vite.config.js", "vite.config.d.ts"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    plugins: { "react-hooks": reactHooks },
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // Permite variables "_algo" sin usar (convencion para "lo ignoro a proposito").
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
]);
