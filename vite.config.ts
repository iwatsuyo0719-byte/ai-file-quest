import { defineConfig } from "vitest/config";

export default defineConfig({
  // GitHub Pages（/ai-file-quest/）でもローカルでも動くよう相対パスで出力する
  base: "./",
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
