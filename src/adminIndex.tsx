import "regenerator-runtime/runtime";
import "lib/polyfills";
import "styles/tailwind.css";
// The design system's CSS custom properties live in Shared.scss — without it every
// var(--primary-btn-bg) resolves to nothing and buttons render unstyled. The trading app picks
// these up from App.tsx; this app has no App.tsx, so it loads them here. Deliberately excludes the
// trading-only sheets (recharts, DeprecatedExchangeStyles, App.scss).
import "styles/Font.css";
import "styles/Shared.scss";
import "styles/Input.css";
import "react-toastify/dist/ReactToastify.css";
import "lib/monkeyPatching";

import React from "react";
import { createRoot } from "react-dom/client";

import WalletProvider from "lib/wallets/WalletProvider";

import AdminApp from "./AdminApp/AdminApp";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WalletProvider>
      <AdminApp />
    </WalletProvider>
  </React.StrictMode>
);
