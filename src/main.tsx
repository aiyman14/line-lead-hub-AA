import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n/config";
import { initializeCapacitor, initializePushNotifications } from "./lib/capacitor";

// Initialize Capacitor for native functionality
initializeCapacitor().then(() => {
  // Initialize push notifications after Capacitor is ready
  initializePushNotifications();
});

createRoot(document.getElementById("root")!).render(<App />);
