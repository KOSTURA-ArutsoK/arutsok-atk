import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

const rootElement = document.getElementById("root");
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        console.log("[ATK SW] Registered:", reg.scope);
      })
      .catch((err) => {
        console.warn("[ATK SW] Registration failed:", err);
      });
  });
}
