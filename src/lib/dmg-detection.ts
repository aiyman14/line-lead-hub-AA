/**
 * Utility to detect if the macOS app is running from a DMG (mounted disk image)
 * and prevent updates until it's moved to Applications.
 */

import { isTauri } from "./capacitor";

let cachedResult: boolean | null = null;

/**
 * Check if the app is running from a DMG on macOS.
 * Returns false on Windows/Linux or web.
 */
export async function isRunningFromDMG(): Promise<boolean> {
  // Return cached result if available
  if (cachedResult !== null) {
    return cachedResult;
  }

  // Only relevant in Tauri desktop environment
  if (!isTauri()) {
    cachedResult = false;
    return false;
  }

  try {
    // Check if we're on macOS
    const osModule = await import("@tauri-apps/plugin-os").catch(() => null);
    if (!osModule) {
      // Fallback: check navigator.platform
      const isMacOS = navigator.platform?.toLowerCase().includes("mac");
      if (!isMacOS) {
        cachedResult = false;
        return false;
      }
    } else {
      const platform = osModule.platform?.() || (await osModule.platform?.());
      if (platform !== "macos") {
        cachedResult = false;
        return false;
      }
    }

    // Try to get the executable path using Tauri's path API
    const pathModule = await import("@tauri-apps/api/path").catch(() => null);
    
    if (pathModule?.resourceDir) {
      try {
        const resourcePath = await pathModule.resourceDir();
        // If running from a DMG, the path will contain "/Volumes/"
        if (resourcePath.includes("/Volumes/")) {
          cachedResult = true;
          return true;
        }
      } catch (e) {
        console.warn("Could not get resource dir:", e);
      }
    }

    // Alternative: Try getting the app data dir or executable path
    if (pathModule?.appDataDir) {
      try {
        const appDataPath = await pathModule.appDataDir();
        // App data path won't be in /Volumes/, but we can use it as context
        console.log("App data path:", appDataPath);
      } catch (e) {
        // Ignore
      }
    }

    // Last resort: use window.__TAURI_INTERNALS__ if available
    const tauriInternals = (window as any).__TAURI_INTERNALS__;
    if (tauriInternals?.plugins?.path) {
      try {
        // Check if any internal path contains /Volumes/
        const execPath = await tauriInternals.invoke("plugin:path|resolve_directory", { 
          directory: "Resource" 
        }).catch(() => null);
        
        if (execPath && typeof execPath === "string" && execPath.includes("/Volumes/")) {
          cachedResult = true;
          return true;
        }
      } catch (e) {
        // Ignore
      }
    }

    cachedResult = false;
    return false;
  } catch (error) {
    console.error("Error checking DMG status:", error);
    cachedResult = false;
    return false;
  }
}

/**
 * Open the /Applications folder on macOS using shell
 */
export async function openApplicationsFolder(): Promise<void> {
  try {
    const shellModule = await import("@tauri-apps/plugin-shell").catch(() => null);
    
    if (shellModule?.open) {
      await shellModule.open("/Applications");
    } else {
      // Fallback to Command if open is not available
      const { Command } = shellModule || {};
      if (Command) {
        const cmd = Command.create("open", ["/Applications"]);
        await cmd.execute();
      }
    }
  } catch (error) {
    console.error("Failed to open Applications folder:", error);
  }
}

/**
 * Exit the application
 */
export async function exitApp(): Promise<void> {
  try {
    const processModule = await import("@tauri-apps/plugin-process").catch(() => null);
    
    if (processModule?.exit) {
      await processModule.exit(0);
    }
  } catch (error) {
    console.error("Failed to exit app:", error);
    // Fallback: close window
    window.close();
  }
}

/**
 * Clear the cached DMG detection result (useful for testing)
 */
export function clearDMGCache(): void {
  cachedResult = null;
}
