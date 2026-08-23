import { resolve } from "path";
import { defineConfig } from "vite";

import defaultConfig from "./vite.config";

/**
 * Build target for the partnerships admin console.
 *
 * Same source tree and design system as the trading app, separate bundle and separate deploy —
 * the console is internal, so it should not ship inside the app a trader loads. `noindex` on the
 * page and a distinct output directory keep the two apart.
 */
export default defineConfig((props) => {
  const config = defaultConfig(props) as any;
  return {
    ...config,
    build: {
      ...config.build,
      outDir: resolve(__dirname, "build-admin"),
      rollupOptions: {
        ...config.build?.rollupOptions,
        input: { admin: resolve(__dirname, "admin.html") },
      },
    },
    server: {
      ...config.server,
      port: 3012,
      open: "/admin.html",
    },
  };
});
