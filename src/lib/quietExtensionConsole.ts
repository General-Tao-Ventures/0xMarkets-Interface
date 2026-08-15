/**
 * MetaMask / wallet extensions spam the console with unactionable noise
 * (Failed to connect, MaxListenersExceeded, ObjectMultiplex, message-channel).
 * Filter those patterns so real app errors stay visible.
 */
const NOISY_PATTERNS = [
  /Failed to connect to MetaMask/i,
  /MetaMask extension not found/i,
  /MaxListenersExceededWarning/i,
  /ObjectMultiplex - orphaned data/i,
  /message channel closed before a response was received/i,
  /A listener indicated an asynchronous response by returning true/i,
  /chrome-extension:\/\//i,
  /moz-extension:\/\//i,
];

function stringifyArg(arg: unknown): string {
  if (typeof arg === "string") return arg;
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
  try {
    return String(arg);
  } catch {
    return "";
  }
}

function isNoisy(...args: unknown[]): boolean {
  const text = args.map(stringifyArg).join(" ");
  return NOISY_PATTERNS.some((re) => re.test(text));
}

function wrapConsoleMethod(method: "error" | "warn") {
  const original = console[method].bind(console);
  console[method] = (...args: unknown[]) => {
    if (isNoisy(...args)) return;
    original(...args);
  };
}

export function quietExtensionConsole() {
  if (typeof window === "undefined") return;

  wrapConsoleMethod("error");
  wrapConsoleMethod("warn");

  // MetaMask often surfaces these as unhandled promise rejections.
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const text =
      reason instanceof Error
        ? `${reason.name}: ${reason.message}`
        : typeof reason === "string"
          ? reason
          : String(reason ?? "");
    if (NOISY_PATTERNS.some((re) => re.test(text))) {
      event.preventDefault();
    }
  });
}
