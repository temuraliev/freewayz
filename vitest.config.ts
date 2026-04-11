import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@frontend": path.resolve(__dirname, "./src/frontend"),
      "@backend": path.resolve(__dirname, "./src/backend"),
      "@shared": path.resolve(__dirname, "./src/shared"),
    },
  },
});
