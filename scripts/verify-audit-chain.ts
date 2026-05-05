/**
 * CLI helper — verifies SHA-256 audit hash linkage against DATABASE_URL.
 *
 * Usage (PowerShell): `npm run audit:verify`
 * Exit code 0 when verification succeeds or the audit table is empty; 1 when the chain breaks.
 */
import { verifyAuditChainIntegrity } from "../src/lib/audit.ts";
import { prisma } from "../src/lib/prisma.ts";

async function main() {
  try {
    const strict = process.env.AUDIT_VERIFY_STRICT === "1";
    const result = await verifyAuditChainIntegrity({
      treatAllLegacyWithoutHashesAsOk: !strict,
    });
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
