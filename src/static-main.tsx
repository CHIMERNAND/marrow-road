import React from "react";
import { createRoot } from "react-dom/client";
import { HelmsDeepGame } from "./components/HelmsDeepGame";
import "./styles.css";

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(
    <React.StrictMode>
      <HelmsDeepGame />
    </React.StrictMode>,
  );
}
