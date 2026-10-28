import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { DialogHost } from "./app/lib/dialog";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <DialogHost />
  </>
);

// Lets the website open without internet after the first visit
// (offline-first scanning). Only in the deployed version.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
