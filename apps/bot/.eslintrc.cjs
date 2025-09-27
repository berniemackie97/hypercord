module.exports = {
  root: true,
  env: { es2022: true, node: true },
  parser: "@typescript-eslint/parser",
  parserOptions: { project: false, ecmaVersion: "latest", sourceType: "module" },
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier"],
  rules: {}
};
