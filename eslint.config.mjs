import nextPlugin from "@next/eslint-plugin-next"
import tseslint from "typescript-eslint"
import reactHooks from "eslint-plugin-react-hooks"

export default tseslint.config(
  {
    ignores: [".next/**", "node_modules/**", "e2e/**", "next.config.ts"],
  },
  ...tseslint.configs.recommended,
  {
    plugins: {
      "@next/next": nextPlugin,
      "react-hooks": reactHooks,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      // React hooks correctness. `rules-of-hooks` is an error (breaking it is a
      // bug); `exhaustive-deps` is a warning because a few existing effects
      // intentionally omit deps.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // Treat a leading underscore as an intentionally-ignored binding.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
    },
  },
  {
    // The seed script is an operator-facing CLI; console output is its UI.
    files: ["prisma/**/*.ts"],
    rules: { "no-console": "off" },
  },
)
