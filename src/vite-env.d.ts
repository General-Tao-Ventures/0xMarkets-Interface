/// <reference types="vite-plugin-svgr/client" />
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_APP_VERSION?: string;
  readonly VITE_APP_UI_FEE_RECEIVER?: string;
  /** Comma-separated addresses allowed to open the partnerships admin console. UI gate only. */
  readonly VITE_PARTNER_ADMIN_ADDRESSES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
