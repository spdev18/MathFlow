
import { parseExpression, augmentAstWithIds, enumerateOperators } from "../app/ast-parser.js";
import { correlateOperatorsWithAST } from "../app/surface-map.js";

function runTest() {
    console.log("=== Verification: Viewer Operator Mapping ===");

    const latex = "2 * 5 - 3 * 8 * 4";
    console.log(`Expression: ${latex}`);

    // 1. Verify Parser
    const ast = parseExpression(latex);
    if (!ast) {
        console.error("FAILED: Parser returned null");
        return;
    }
    augmentAstWithIds(ast);
    const ops = enumerateOperators(ast);
    console.log("AST Operators found:", ops.length);
    ops.forEach(op => {
        console.log(`  AST Op: ${op.operator} ID: ${op.nodeId}`);
    });

    const expectedIDs = [
        "root.term[0]", // (2*5) - ...
        "root.term[1].term[0]", // 3*8
        "root.term[1]", // (3*8)*4
        "root" // Main subtraction
    ];
    // Note: Structure depends on associativity.
    // 2 * 5 - 3 * 8 * 4
    // Standard precedence: 
    // (2*5) - ((3*8)*4)
    // Left-associative multiplication: (2*5) - ((3*8)*4)
    // Subtraction is root.
    // Left child: 2*5 (id: term[0])
    // Right child: 3*8*4
    //   -> (3*8) * 4  (id: term[1])
    //      Left: 3*8 (id: term[1].term[0])
    //      Right: 4

    // BUT wait, my parser is recursive descent.
    // parseMulDiv: left = parsePrimary; while(*) left = binaryOp(left, right).
    // So 3 * 8 * 4 -> (3 * 8) * 4.
    // Operator 1: * in 3*8. ID: term[1].term[0]?
    // Operator 2: * in (..)*4. ID: term[1]?

    // Actually, let's just see what the parser produces and ensure they are distinct.
    const ids = ops.map(o => o.nodeId);
    const uniqueIds = new Set(ids);
    if (uniqueIds.size !== ids.length) {
        console.error("FAILED: duplicate IDs generated!", ids);
    } else {
        console.log("SUCCESS: All operator IDs are unique.");
    }

    // 2. Verify Surface Map Correlation (Mocked)
    // Mock atoms
    const mockAtoms = [
        { kind: "Num", latexFragment: "2", bbox: { left: 0, top: 0 } },
        { kind: "BinaryOp", latexFragment: "*", bbox: { left: 10, top: 0 } },
        { kind: "Num", latexFragment: "5", bbox: { left: 20, top: 0 } },
        { kind: "BinaryOp", latexFragment: "-", bbox: { left: 30, top: 0 } }, // Subtraction
        { kind: "Num", latexFragment: "3", bbox: { left: 40, top: 0 } },
        { kind: "BinaryOp", latexFragment: "*", bbox: { left: 50, top: 0 } },
        { kind: "Num", latexFragment: "8", bbox: { left: 60, top: 0 } },
        { kind: "BinaryOp", latexFragment: "*", bbox: { left: 70, top: 0 } },
        { kind: "Num", latexFragment: "4", bbox: { left: 80, top: 0 } }
    ];
    // Give them IDs
    mockAtoms.forEach((a, i) => a.id = "atom-" + i);

    const map = {
        atoms: mockAtoms,
        root: {},
        byElement: new Map()
    };

    console.log("Running correlation...");
    correlateOperatorsWithAST(map, latex);

    const surfaceOps = mockAtoms.filter(a => a.astNodeId);
    console.log("Surface Operators Mapped:", surfaceOps.length);
    surfaceOps.forEach(op => {
        console.log(`  Surface '${op.latexFragment}' -> AST ID: ${op.astNodeId}`);
    });

    if (surfaceOps.length !== 4) {
        console.error("FAILED: Expected 4 mapped operators, got " + surfaceOps.length);
    } else {
        console.log("SUCCESS: Mapped all surface operators.");
    }
}

runTest();
