import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  // The provided environment file lives next to the project directory.
  const envDir = path.resolve(__dirname, "..");
  const serverEnv = loadEnv(mode, envDir, "");
  for (const name of ["OPENAI_API_KEY", "OPENAI_PERFUME_MODEL"]) {
    if (!process.env[name] && serverEnv[name]) process.env[name] = serverEnv[name];
  }

  return {
    envDir,
    // Kinde identifiers are public client configuration; database tokens are not.
    // Keep OpenAI credentials out of import.meta.env and client bundles.
    envPrefix: ["VITE_", "AUTH_", "DOMAIN_"],
    plugins: [tanstackStart(), tailwindcss(), react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
      tsconfigPaths: true,
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
      // officeparser ships as a self-contained browser bundle (~5.4 MB) and is loaded
      // only when an admin imports a document, so keep the warning focused on regressions.
      chunkSizeWarningLimit: 5600,
      rolldownOptions: {
        checks: {
          pluginTimings: false,
        },
      },
    },
    server: {
      host: "0.0.0.0",
      port: 4173,
    },
  };
});
