import { defineConfig } from "vite";
import webExtension from "vite-plugin-web-extension";

export default defineConfig({
  plugins: [
    webExtension({
      manifest: "public/manifest.json"
    })
  ],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"]
  }
});
