import "regenerator-runtime/runtime";
import "lib/polyfills";
import "styles/tailwind.css";
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
