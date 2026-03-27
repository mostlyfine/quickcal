import { readFileSync } from "node:fs";
import { defineConfig, loadEnv } from "vite";
import webExtension from "vite-plugin-web-extension";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      webExtension({
        manifest: () => {
          const manifest = JSON.parse(readFileSync("public/manifest.json", "utf-8"));
          manifest.oauth2.client_id = env.GOOGLE_OAUTH_CLIENT_ID ?? "";
          return manifest;
        }
      })
    ],
    test: {
      environment: "node",
      include: ["tests/**/*.test.ts"]
    }
  };
});
