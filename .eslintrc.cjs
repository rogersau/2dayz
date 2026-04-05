module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    project: false,
  },
  ignorePatterns: ["dist/", "coverage/", "node_modules/"],
  overrides: [
    {
      files: ["**/*.ts", "**/*.tsx", "vitest.workspace.ts"],
      parserOptions: {
        project: false,
      },
    },
  ],
};
