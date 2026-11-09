import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "@/app/App";
import { ThemedToaster } from "@/app/providers/ThemedToaster";
import "@/app/styles/index.css";
import "@/shared/config/i18n/i18n";

const container = document.getElementById("root");
if (container === null) {
  throw new Error("Root element #root not found");
}

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <ThemedToaster />
    </BrowserRouter>
  </StrictMode>,
);
