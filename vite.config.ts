import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // The provided environment file lives next to the project directory.
  envDir: "..",
  // Kinde identifiers are public client configuration; database tokens are not.
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
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Separate vendor libraries
          if (id.includes("node_modules")) {
            if (id.includes("react")) return "vendor-react";
            if (
              id.includes("@tanstack/react-query") ||
              id.includes("@tanstack/react-router")
            )
              return "vendor-tanstack";
            if (
              id.includes("recharts") ||
              id.includes("sonner") ||
              id.includes("date-fns") ||
              id.includes("cmdk") ||
              id.includes("vaul") ||
              id.includes("@radix-ui")
            )
              return "vendor-ui";
            return "vendor-other";
          }
          // Separate large admin pages
          if (id.includes("admin.pedidos")) return "admin-pedidos";
          if (id.includes("admin.productos")) return "admin-productos";
          if (id.includes("admin.panel")) return "admin-panel";
          if (id.includes("admin.")) return "admin-pages";
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 4173,
  },
});
