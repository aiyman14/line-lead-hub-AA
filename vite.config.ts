import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Tauri packages that need special handling
const tauriPackages = [
  "@tauri-apps/api",
  "@tauri-apps/plugin-updater",
  "@tauri-apps/plugin-process",
  "@tauri-apps/plugin-shell",
];

// Check if we're building for Tauri (set by tauri build command)
const isTauriBuild = !!process.env.TAURI_ENV_PLATFORM;

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  esbuild: {
    drop: mode === "production" ? ["console", "debugger"] : [],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    // Only exclude Tauri plugins from pre-bundling in web mode
    exclude: isTauriBuild ? [] : tauriPackages,
    // Force include React packages to ensure single instance
    include: ["react", "react-dom", "@tanstack/react-query", "next-themes"],
    // Force re-bundling by changing this value when needed
    force: true,
  },
  build: {
    rollupOptions: {
      // Only mark Tauri plugins as external for web builds, NOT for Tauri builds
      external: isTauriBuild
        ? []
        : (id) => tauriPackages.some((pkg) => id === pkg || id.startsWith(`${pkg}/`)),
    },
  },
}));
