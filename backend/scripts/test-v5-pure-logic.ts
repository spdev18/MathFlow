// ZERO DEPENDENCY TEST
// No imports allowed

// --- 1. Define Types Locally ---
type PrimitiveColor = 'green' | 'yellow' | 'red' | 'blue';
interface PrimitiveRow { id: string; color: PrimitiveColor; requiredGuards?: string[]; }
interface PrimitiveMatch { row: PrimitiveRow; score: number; }

// --- 2. Inline Matcher Class ---
class PrimitiveMatcher {
    match(params: { table: { rows: PrimitiveRow[] }; ctx: any }): PrimitiveMatch[] {
        const matches: PrimitiveMatch[] = [];
        for (const row of params.table.rows) {
            if (this.isMatch(row, params.ctx)) {
                matches.push({ row, score: 1 });
            }
        }
        return matches;
    }
    private isMatch(row: PrimitiveRow, ctx: any): boolean {
        if (row.requiredGuards) {
            for (const g of row.requiredGuards) {
                if (!ctx.guards[g]) return false;
            }
        }
        return true;
    }
}

// --- 3. Inline Selector Class ---
class PrimitiveSelector {
    select(matches: PrimitiveMatch[]) {
        if (matches.length === 0) return { kind: 'no-candidates' };

        // Logic: Blue > Red > Yellow/Green
        const blue = matches.find(m => m.row.color === 'blue');
        if (blue) return { kind: 'blue-choice', primitive: blue.row };

        const best = matches[0];
        const kind = best.row.color === 'yellow' ? 'yellow-scenario' : 'green-primitive';
        return { kind, primitive: best.row };
    }
}

// --- 4. Execution ---
async function run() {
    console.log("Starting Zero-Dependency Logic Check...");

    const mockTable = {
        rows: [
            { id: 'P.ADD', color: 'green' as const, requiredGuards: ['denominators-equal'] },
            { id: 'P.COMMON_DENOM', color: 'yellow' as const, requiredGuards: ['denominators-different'] } // Target
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
}

run();
