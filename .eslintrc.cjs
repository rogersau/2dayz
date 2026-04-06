module.exports = {
  root: true,
  env: {
    es2022: true,
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
