import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

// Using a placeholder component instead of directly importing @medusajs/dashboard
// This will be replaced by the actual build process
const App = () => (
  <div>
    <h1>Admin Dashboard</h1>
    <p>Loading...</p>
  </div>
);

let root = null;

if (!root) {
  root = ReactDOM.createRoot(document.getElementById("medusa"));
}

root.render(
  <React.StrictMode>
    <App plugins={[]} />
  </React.StrictMode>
);

if (import.meta.hot) {
  import.meta.hot.accept();
}
