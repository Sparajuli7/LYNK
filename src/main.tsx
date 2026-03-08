
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";

  // Set --app-height to actual viewport height (fixes Android WebView sizing)
  function setAppHeight() {
    document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
  }
  setAppHeight();
  window.addEventListener('resize', setAppHeight);

  createRoot(document.getElementById("root")!).render(<App />);

  // Register service worker for Web Push notifications
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('SW registration failed:', err)
    })
  }
