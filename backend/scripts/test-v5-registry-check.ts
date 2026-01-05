
/**
 * Registry Isolation Check
 * Verifies that the V5 registry loads without hanging.
 */
import { PRIMITIVES_V5_TABLE } from "../src/engine/primitives.registry.v5";

console.log("Loading V5 Registry...");
console.log(`Registry loaded successfully. Row count: ${PRIMITIVES_V5_TABLE.rows.length}`);
process.exit(0);
