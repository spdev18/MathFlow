import * as fs from 'fs';
import * as path from 'path';
import { parseExpression, AstNode } from '../src/mapmaster/ast';
import { GenericPatternMatcher } from '../src/mapmaster/GenericPatternMatcher';

interface TestScenario {
    id: string;
    latex: string;
    pattern: string;
    description: string;
}

function findMatch(node: AstNode, matcher: GenericPatternMatcher): boolean {
    // 1. Try match at current node
    if (matcher.matches(node)) {
        return true;
    }

    // 2. Recurse
    if (node.type === "group") {
        return findMatch((node as any).content, matcher);
    }
    if (node.type === "binaryOp") {
        return findMatch((node as any).left, matcher) || findMatch((node as any).right, matcher);
    }
    // Fraction/Mixed currently don't have child nodes in our AST definition that we traverse for *patterns* usually,
    // but if we want to match inside numerator/denominator, we should parse them if they are strings?
    // Actually, our parser for fractions stores num/den as strings.
    // BUT, if we want to match "2+3" inside "1/(2+3)", the parser MUST have produced a binaryOp/group for the denominator.
    // My previous fix to 'ast.ts' ensures that complex denominators are parsed as binaryOp(/, num, group).
    // So standard binaryOp traversal covers it.

    return false;
}

async function runAudit() {
    const matrixPath = path.join(process.cwd(), 'test_matrix.json');
    if (!fs.existsSync(matrixPath)) {
        console.error("test_matrix.json not found!");
        process.exit(1);
    }

    const matrix: TestScenario[] = JSON.parse(fs.readFileSync(matrixPath, 'utf-8'));

    console.log("Starting System Audit...");
    console.log("---------------------------------------------------");
    console.log("| ID  | Result | Scenario");
    console.log("---------------------------------------------------");

    let passed = 0;
    let failed = 0;

    for (const test of matrix) {
        const ast = parseExpression(test.latex);
        if (!ast) {
            console.log(`| ${test.id} | FAIL   | ${test.description} (Parse Error)`);
            failed++;
            continue;
        }

        const matcher = new GenericPatternMatcher(test.pattern);
        const isMatch = findMatch(ast, matcher);

        if (isMatch) {
            console.log(`| ${test.id} | PASS   | ${test.description}`);
            passed++;
        } else {
            console.log(`| ${test.id} | FAIL   | ${test.description}`);
            failed++;
        }
    }

    console.log("---------------------------------------------------");
    console.log(`Total: ${matrix.length}, Passed: ${passed}, Failed: ${failed}`);

    if (failed > 0) {
        process.exit(1);
    }
}

runAudit();
