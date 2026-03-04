import { execSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================
// Types
// ============================================================

interface SuiteResult {
  name: string;
  status: "PASS" | "FAIL";
  duration: number;
  output: string;
}

interface TestDef {
  name: string;
  file: string;
  env: Record<string, string>;
}

// ============================================================
// Test suite definitions
// ============================================================

const TEST_SUITES: TestDef[] = [
  { name: "Deposits",       file: "test-deposits.ts",       env: { MARKET: "WETH/USD" } },
  { name: "Withdrawals",    file: "test-withdrawals.ts",    env: { MARKET: "WETH/USD" } },
  { name: "Market Orders",  file: "test-orders.ts",         env: { MARKET: "WETH/USD" } },
  { name: "Trigger Orders", file: "test-trigger-orders.ts", env: {} },
  { name: "Liquidation",    file: "test-liquidation.ts",    env: {} },
];

// ============================================================
// CLI flag parsing
// ============================================================

function parseArgs(): { skip: Set<string>; only: string | null } {
  const skip = new Set<string>();
  let only: string | null = null;

  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--skip=")) {
      const names = arg.slice("--skip=".length).split(",");
      for (const n of names) skip.add(n.trim());
    } else if (arg.startsWith("--only=")) {
      only = arg.slice("--only=".length).trim();
    }
  }

  return { skip, only };
}

// ============================================================
// Main
// ============================================================

function main() {
  console.log("=== E2E TEST SUITE ===\n");

  const { skip, only } = parseArgs();
  const cwd = resolve(__dirname);

  // Filter suites based on CLI flags
  let suites = TEST_SUITES;
  if (only) {
    suites = suites.filter((s) => s.name === only);
    if (suites.length === 0) {
      console.error(`Test "${only}" not found. Available: ${TEST_SUITES.map((s) => s.name).join(", ")}`);
      process.exit(1);
    }
    console.log(`Running only: ${only}\n`);
  } else if (skip.size > 0) {
    console.log(`Skipping: ${Array.from(skip).join(", ")}\n`);
    suites = suites.filter((s) => !skip.has(s.name));
  }

  const results: SuiteResult[] = [];
  const suiteStart = Date.now();

  for (let i = 0; i < suites.length; i++) {
    const suite = suites[i];
    console.log(`\n[${ i + 1}/${suites.length}] Running: ${suite.name} (${suite.file})`);
    console.log("=".repeat(60));

    const testStart = Date.now();

    try {
      const output = execSync(`npx tsx ${suite.file}`, {
        cwd,
        env: { ...process.env, ...suite.env },
        stdio: "pipe",
        timeout: 300_000, // 5 min per test
        encoding: "utf-8",
      });

      const duration = (Date.now() - testStart) / 1000;
      console.log(output);
      console.log(`  => ${suite.name}: PASS (${duration.toFixed(1)}s)`);
      results.push({ name: suite.name, status: "PASS", duration, output });
    } catch (err: unknown) {
      const duration = (Date.now() - testStart) / 1000;
      const execErr = err as { stdout?: string; stderr?: string; message?: string };
      const output = (execErr.stdout || "") + "\n" + (execErr.stderr || "");
      console.log(output);
      console.log(`  => ${suite.name}: FAIL (${duration.toFixed(1)}s)`);
      results.push({ name: suite.name, status: "FAIL", duration, output });
    }
  }

  // ── Summary ──────────────────────────────────────────────────
  const totalTime = ((Date.now() - suiteStart) / 1000).toFixed(1);
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  const maxNameLen = Math.max(...results.map((r) => r.name.length));

  console.log("\n\n=== E2E SUITE RESULTS ===\n");

  for (const r of results) {
    const name = r.name.padEnd(maxNameLen + 2);
    const icon = r.status === "PASS" ? "PASS" : "FAIL";
    console.log(`  ${name}${icon}  (${r.duration.toFixed(1)}s)`);
  }

  console.log(`\n${passed}/${results.length} PASSED${failed > 0 ? ` (${failed} failed)` : ""}`);
  console.log(`Total time: ${totalTime}s`);

  process.exit(failed > 0 ? 1 : 0);
}

main();
