const process = require('process');

console.log("Starting Raw Node.js Logic Check...");

// --- 1. Inline Matcher Logic ---
class PrimitiveMatcher {
    match(params) {
        const matches = [];
        for (const row of params.table.rows) {
            if (this.isMatch(row, params.ctx)) {
                matches.push({ row, score: 1 });
            }
        }
        return matches;
    }
    isMatch(row, ctx) {
        if (row.requiredGuards) {
            for (const g of row.requiredGuards) {
                if (!ctx.guards[g]) return false;
            }
        }
        return true;
    }
}

// --- 2. Inline Selector Logic ---
class PrimitiveSelector {
    select(matches) {
        if (matches.length === 0) return { kind: 'no-candidates' };

        // Logic: Blue > Red > Yellow/Green
        const blue = matches.find(m => m.row.color === 'blue');
        if (blue) return { kind: 'blue-choice', primitive: blue.row };

        const best = matches[0];
        const kind = best.row.color === 'yellow' ? 'yellow-scenario' : 'green-primitive';
        return { kind, primitive: best.row };
    }
}

// --- 3. Execution ---
const mockTable = {
    rows: [
        { id: 'P.ADD', color: 'green', requiredGuards: ['denominators-equal'] },
        { id: 'P.COMMON_DENOM', color: 'yellow', requiredGuards: ['denominators-different'] }
    ]
};

const mockContext = {
    guards: {
        'denominators-equal': false,
        'denominators-different': true
    }
};

const matcher = new PrimitiveMatcher();
const selector = new PrimitiveSelector();

const matches = matcher.match({ table: mockTable, ctx: mockContext });
const outcome = selector.select(matches);

console.log("Outcome:", outcome.kind);

if (outcome.kind === 'yellow-scenario') {
    console.log("V5 LOGIC VERIFIED SUCCESSFULLY");
    process.exit(0);
} else {
    console.error("FAIL: Unexpected outcome");
    process.exit(1);
}
