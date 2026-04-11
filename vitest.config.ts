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
      "@": path.resolve(__dirname, "./"),
      "@frontend": path.resolve(__dirname, "./frontend"),
      "@backend": path.resolve(__dirname, "./backend"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
});
