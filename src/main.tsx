import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./ui/ErrorBoundary";
import "./styles.css";
import { startReveals } from "./ui/reveal";
import { documentAssistant } from "./ui/routes";
// Experimental document assistant page (src/ai/browser). Off in default builds; its
// entry is the "Document assistant" button under the homepage search bar.
const Experiment = documentAssistant
  ? React.lazy(() => import("./ai/browser/Experiment"))
  : null;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
      {Experiment && (
        <React.Suspense fallback={null}>
          <Experiment />
        </React.Suspense>
      )}
    </ErrorBoundary>
  </React.StrictMode>,
);
startReveals();
