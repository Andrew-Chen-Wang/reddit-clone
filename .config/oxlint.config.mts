import { defineConfig } from "oxlint"

export default defineConfig({
  plugins: [
    "typescript",
    "react",
    "eslint",
    "nextjs",
    "node",
    "vitest",
    "jsdoc",
    "import",
    "jsx-a11y",
    // react-perf intentionally omitted: its jsx-no-new-*-as-prop rules flag every
    // inline handler/object/JSX prop in render, which only matters for React.memo'd
    // children. Enforcing it would mean wrapping hundreds of handlers in
    // useCallback/useMemo — noise that hurts readability with no real gain here.
    "unicorn",
  ],
  categories: {
    correctness: "error",
    suspicious: "warn",
    perf: "warn",
  },
  options: {
    typeAware: true,
    typeCheck: true,
  },
  env: {
    node: true,
    builtin: true,
  },
  ignorePatterns: [
    "**/.next/**",
    "private_notes/**",
    "**/.config/**",
    "apps/website/postcss.config.js",
    "apps/website/next.config.ts",
    "lib/typescript/api-client/src/generated/**",
    "lib/typescript/api-client/src/admin-generated/**",
    "**/routeTree.gen.ts",
  ],
  rules: {
    "consistent-return": "off",
    "typescript/no-unsafe-type-assertion": "off",
    "typescript/await-thenable": "error",
    "typescript/no-array-delete": "error",
    "typescript/no-base-to-string": "error",
    "typescript/no-confusing-void-expression": "error",
    "typescript/no-deprecated": "error",
    "typescript/no-duplicate-type-constituents": "error",
    "typescript/no-floating-promises": "error",
    "typescript/no-for-in-array": "error",
    "typescript/no-implied-eval": "error",
    "typescript/no-meaningless-void-operator": "error",
    "typescript/no-misused-promises": "error",
    "typescript/no-misused-spread": "error",
    "typescript/no-mixed-enums": "error",
    "typescript/no-redundant-type-constituents": "error",
    "typescript/no-unnecessary-boolean-literal-compare": "error",
    "typescript/no-unnecessary-template-expression": "error",
    "typescript/no-unnecessary-type-arguments": "error",
    "typescript/no-unnecessary-type-assertion": "error",
    "typescript/no-unsafe-argument": "error",
    "typescript/no-unsafe-assignment": "error",
    "typescript/no-unsafe-call": "error",
    "typescript/no-unsafe-enum-comparison": "error",
    "typescript/no-unsafe-member-access": "error",
    "typescript/no-unsafe-return": "error",
    "typescript/no-unsafe-unary-minus": "error",
    "typescript/only-throw-error": "error",
    "typescript/prefer-promise-reject-errors": "error",
    "typescript/prefer-reduce-type-parameter": "error",
    "typescript/prefer-return-this-type": "error",
    "typescript/related-getter-setter-pairs": "error",
    "typescript/require-await": "error",
    "typescript/restrict-plus-operands": [
      "error",
      {
        allowAny: false,
        allowBoolean: false,
        allowNullish: false,
        allowNumberAndString: false,
        allowRegExp: false,
      },
    ],
    "typescript/restrict-template-expressions": [
      "error",
      {
        allowNumber: true,
        allowBoolean: true,
      },
    ],
    "typescript/return-await": ["error", "error-handling-correctness-only"],
    "typescript/unbound-method": "error",
    "typescript/use-unknown-in-catch-callback-variable": "error",
    "typescript/non-nullable-type-assertion-style": "error",
    "typescript/prefer-find": "error",
    "typescript/prefer-includes": "error",
    "typescript/prefer-nullish-coalescing": "error",
    "typescript/prefer-regexp-exec": "error",
    "typescript/prefer-string-starts-ends-with": "error",
    "import/no-unassigned-import": ["warn", { allow: ["**/*.css"] }],
    // Elasticsearch/OpenSearch responses use underscore-prefixed fields
    // (_source, _id, _score); we don't control that naming.
    "no-underscore-dangle": "off",
    // Sequential awaits in a loop are correct across this codebase: ordered DB
    // writes, cursor pagination, ES bulk batches, and seed scripts. Converting
    // them to Promise.all would risk connection-pool exhaustion and write-order
    // bugs. A handful of API read paths could be parallelized deliberately, but
    // that's a per-case optimization, not a blanket rule.
    "no-await-in-loop": "off",
  },
  overrides: [
    {
      files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
      rules: {
        "no-var": "error",
        "prefer-const": "error",
        "prefer-rest-params": "error",
        "prefer-spread": "error",
      },
    },
    {
      files: [
        "**/apps/website/**/*.tsx",
        "**/apps/frontends/**/*.tsx",
        "**/lib/typescript/**/*.tsx",
      ],
      rules: {
        "react/react-in-jsx-scope": "off",
      },
    },
    {
      // Vendored shadcn/base-ui primitives. Their nested render components
      // (react-day-picker slots), constructed context values, index keys, and
      // prop shadowing are upstream patterns; editing them only creates
      // divergence we lose when a component is re-pulled from shadcn.
      files: ["**/lib/typescript/ui/base/src/ui/**"],
      rules: {
        "react/no-unstable-nested-components": "off",
        "react/jsx-no-constructed-context-values": "off",
        "react/no-array-index-key": "off",
        "no-shadow": "off",
        "typescript/no-unnecessary-type-conversion": "off",
      },
    },
    {
      // Seed scripts build queries against kysely's dynamically-typed
      // onConflict/insert builders (legitimately `any`), so the strict
      // type-safety rules are noise here — not app code.
      files: ["**/apps/dbmigrator/src/seeds/**"],
      rules: {
        "typescript/no-unsafe-argument": "off",
        "typescript/no-unsafe-assignment": "off",
        "typescript/no-unsafe-call": "off",
        "typescript/no-unsafe-member-access": "off",
        "typescript/no-unsafe-return": "off",
        "typescript/non-nullable-type-assertion-style": "off",
      },
    },
  ],
})
