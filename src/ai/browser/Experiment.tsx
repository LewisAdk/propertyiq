import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { navigate } from "../../ui/routes";
import DocumentReview from "./DocumentReview";
import "./workspace.css";

const ROUTES = ["#documents", "#research-lab"];
const isOpen = () => ROUTES.includes(window.location.hash);

// The document assistant page (#documents, #research-lab). Its only entry is the
// "Document assistant" button under the homepage search bar; nothing floats over the
// app. The app stays mounted but hidden, so returning keeps the user's analysis.
export default function Experiment() {
  const [open, setOpen] = useState(isOpen);
  useEffect(() => {
    const sync = () => setOpen(isOpen());
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    sync(); // catch a hash change between first render and this effect
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
    };
  }, []);
  useEffect(() => {
    const root = document.getElementById("root");
    if (root) root.hidden = open;
    if (open) window.scrollTo(0, 0);
  }, [open]);
  if (!open) return null;
  return createPortal(
    <div className="dr-overlay">
      <DocumentReview
        onBack={() => {
          navigate("#home");
          // Return keyboard focus to the button that opened the page.
          requestAnimationFrame(() =>
            document.querySelector<HTMLElement>(".iq-assist")?.focus(),
          );
        }}
      />
    </div>,
    document.body,
  );
}
