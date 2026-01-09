import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Tauri packages that should not be bundled in web mode
const tauriPackages = [
  "@tauri-apps/api",
  "@tauri-apps/plugin-updater",
  "@tauri-apps/plugin-process",
  "@tauri-apps/plugin-shell",
];

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    // Exclude Tauri plugins from pre-bundling to prevent duplicate React issues in web mode
    exclude: tauriPackages,
  },
  build: {
    rollupOptions: {
      // Mark Tauri plugins as external for production builds
      external: (id) => tauriPackages.some((pkg) => id === pkg || id.startsWith(`${pkg}/`)),
    },
  },
}));
