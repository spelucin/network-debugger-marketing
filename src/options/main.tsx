import { createRoot } from "react-dom/client";
import { App } from "./App";
import "../sidepanel/styles/global.css";

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(<App />);
}