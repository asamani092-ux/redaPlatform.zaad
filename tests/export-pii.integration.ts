import "dotenv/config";
import { Role } from "../src/generated/prisma/client";
import { canExportFullIdentity, redactIdentityFields } from "../src/lib/pii";
import { assert } from "./helpers";

async function main() {
  console.log("=== export identity authority ===");
  assert(canExportFullIdentity(Role.ADMIN) === true, "admin can export");
  assert(canExportFullIdentity(Role.REPORTS) === false, "reports cannot export full identity");
  assert(canExportFullIdentity(Role.RECEPTION) === false, "reception denied");
  assert(canExportFullIdentity(Role.DISTRIBUTION) === false, "distribution denied");

  const rows = [
    { name: "أ", nationalId: "1100000007", mobile: "0500000001" },
    { name: "ب", nationalId: "1100000008", mobile: "0500000002" },
  ];
  const redacted = redactIdentityFields(rows, false);
  assert(redacted[0]!.nationalId === "••••••••••", "nationalId redacted");
  assert(redacted[0]!.mobile === "••••••••••", "mobile redacted");
  const full = redactIdentityFields(rows, true);
  assert(full[0]!.nationalId === "1100000007", "admin sees full id");

  // Simulate server deny for non-admin full export request
  function exportGuard(role: Role, format: string, fullIdentityFlag: boolean) {
    if ((format === "xlsx" || format === "pdf") && !canExportFullIdentity(role)) {
      return 403;
    }
    if (fullIdentityFlag && !canExportFullIdentity(role)) return 403;
    return 200;
  }
  assert(exportGuard(Role.REPORTS, "xlsx", false) === 403, "reports xlsx denied");
  assert(exportGuard(Role.REPORTS, "pdf", true) === 403, "reports pdf denied");
  assert(exportGuard(Role.ADMIN, "xlsx", true) === 200, "admin xlsx allowed");

  console.log("=== grep: no identity console logging in src ===");
  // Enforced separately in run-all via shell grep; here we document expectation.
  console.log("EXPORT PII TESTS PASSED");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
