import { spawnSync } from "child_process";
import path from "path";

const root = path.join(__dirname, "..");

function run(label: string, cmd: string, args: string[]) {
  console.log(`\n######## ${label} ########`);
  const r = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
    shell: false,
  });
  if (r.status !== 0) {
    console.error(`STOP-GATE FAIL: ${label} exit=${r.status}`);
    process.exit(r.status ?? 1);
  }
}

function grepNoPiiLogs() {
  console.log("\n######## D3 grep: no ID/phone in src logs ########");
  const r = spawnSync(
    "rg",
    [
      "-n",
      "console\\.(log|info|warn|error|debug)\\([^)]*(nationalId|mobile|هوية|جوال)",
      "src",
    ],
    { cwd: root, encoding: "utf8" },
  );
  // rg exit 1 = no matches (good); 0 = matches (bad)
  if (r.status === 0 && r.stdout?.trim()) {
    console.error(r.stdout);
    console.error("FAIL: PII-like console logging found");
    process.exit(1);
  }
  console.log("OK: no PII console logging matches in src/");
}

run("D0 daily reports (unit)", "npx", ["tsx", "tests/daily-report.unit.ts"]);
run("D0 report extended metrics (unit)", "npx", ["tsx", "tests/report-extended-metrics.unit.ts"]);
run("D0 presentation kpi kinds (unit)", "npx", ["tsx", "tests/presentation-kpi-kinds.unit.ts"]);
run("D0 survey delivery (unit)", "npx", ["tsx", "tests/survey-delivery.unit.ts"]);
run("D0 survey question types (unit)", "npx", ["tsx", "tests/survey-question-types.unit.ts"]);
run("D1 entitlement", "npx", ["tsx", "tests/entitlement.integration.ts"]);
run("D1 attendance/dispense", "npx", ["tsx", "tests/attendance-dispense.integration.ts"]);
run("D2 audit coverage", "npx", ["tsx", "tests/audit-coverage.integration.ts"]);
run("D3 export PII", "npx", ["tsx", "tests/export-pii.integration.ts"]);
grepNoPiiLogs();
run("D5 QR cards", "npx", ["tsx", "tests/qr-cards.integration.ts"]);

// D4 backup + restore drill
run("D4 backup", "bash", ["scripts/backup.sh"]);
run("D4 restore-drill", "bash", ["scripts/restore-drill.sh"]);

console.log("\nALL TESTS PASSED (CMD-B)");
