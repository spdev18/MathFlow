/**
 * MapMaster AST & Parser (TzV1.1)
 * 
 * Provides a robust, recursive descent parser for mathematical expressions
 * supporting integers, fractions, mixed numbers, and binary operations.
 */

export type NodeType = "integer" | "fraction" | "mixed" | "binaryOp" | "variable";

export interface BaseNode {
    type: NodeType;
}

export interface IntegerNode extends BaseNode {
    type: "integer";
    value: string;
}

export interface FractionNode extends BaseNode {
    type: "fraction";
    numerator: string;
    denominator: string;
}

export interface MixedNumberNode extends BaseNode {
    type: "mixed";
    whole: string;
    numerator: string;
    denominator: string;
}

export interface BinaryOpNode extends BaseNode {
    type: "binaryOp";
    op: "+" | "-" | "*" | "/" | "\\div";
    left: AstNode;
    right: AstNode;
}

export interface VariableNode extends BaseNode {
    type: "variable";
    name: string;
}

export type AstNode = IntegerNode | FractionNode | MixedNumberNode | BinaryOpNode | VariableNode;

// --- Tokenizer ---

type TokenType = "NUMBER" | "OP" | "LPAREN" | "RPAREN" | "SLASH" | "SPACE" | "IDENTIFIER" | "LBRACE" | "RBRACE" | "COMMAND" | "COLON";

interface Token {
    type: TokenType;
    value: string;
    pos: number;
}

function tokenize(input: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    while (i < input.length) {
        const char = input[i];

        if (/\s/.test(char)) {
            // Coalesce spaces
            let val = char;
            i++;
            while (i < input.length && /\s/.test(input[i])) {
                val += input[i];
                i++;
            }
            tokens.push({ type: "SPACE", value: val, pos: i - val.length });
            continue;
        }

        if (/\d/.test(char)) {
            let val = char;
            i++;
            while (i < input.length && (/\d/.test(input[i]) || input[i] === ".")) {
                val += input[i];
                i++;
            }
            tokens.push({ type: "NUMBER", value: val, pos: i - val.length });
            continue;
        }

        if (/[a-zA-Z]/.test(char)) {
            let val = char;
            i++;
            while (i < input.length && /[a-zA-Z]/.test(input[i])) {
                val += input[i];
                i++;
            }
            tokens.push({ type: "IDENTIFIER", value: val, pos: i - val.length });
            continue;
        }

        if (char === "\\") {
            let val = ""; // Don't include backslash in value? Or do? Let's include it or just the name.
            // Let's just capture the command name.
            i++; // skip backslash
            while (i < input.length && /[a-zA-Z]/.test(input[i])) {
                val += input[i];
                i++;
            }
            tokens.push({ type: "COMMAND", value: val, pos: i - val.length - 1 });
            continue;
        }

        if (["+", "-", "*", "^"].includes(char)) {
            tokens.push({ type: "OP", value: char, pos: i });
            i++;
            continue;
        }

        if (char === "/") {
            tokens.push({ type: "SLASH", value: "/", pos: i });
            i++;
            continue;
        }

        if (char === ":") {
            tokens.push({ type: "COLON", value: ":", pos: i });
            i++;
            continue;
        }

        if (char === "(") {
            tokens.push({ type: "LPAREN", value: char, pos: i });
            i++;
            continue;
        }

        if (char === ")") {
            tokens.push({ type: "RPAREN", value: char, pos: i });
            i++;
            continue;
        }

        if (char === "{") {
            tokens.push({ type: "LBRACE", value: char, pos: i });
            i++;
            continue;
        }

        if (char === "}") {
            tokens.push({ type: "RBRACE", value: char, pos: i });
            i++;
            continue;
        }

        // Unknown char, skip or error? For now skip
        i++;
    }
    return tokens;
}

// --- Parser ---

export function parseExpression(latex: string): AstNode | undefined {
    const tokens = tokenize(latex).filter(t => t.type !== "SPACE" || t.value.includes(" "));
    const processedTokens = preprocessMixedNumbers(tokens);

    let pos = 0;

    function peek(): Token | undefined {
        return processedTokens[pos];
    }

    function consume(): Token | undefined {
        return processedTokens[pos++];
    }

    function parsePrimary(): AstNode {
        const token = peek();
        if (!token) throw new Error("Unexpected end of input");

        if (token.type === "NUMBER") {
            consume();
            // Check for lookahead slash for fraction
            if (peek()?.type === "SLASH") {
                consume(); // /
                const den = consume();
                if (den?.type !== "NUMBER" && den?.type !== "IDENTIFIER") throw new Error("Expected denominator");
                // Allow variable in denominator for patterns like 1/a
                if (den.type === "IDENTIFIER") {
                    return {
                        type: "fraction",
                        numerator: token.value,
                        denominator: den.value
                    };
                }
                return {
                    type: "fraction",
                    numerator: token.value,
                    denominator: den.value
                };
            }
            return { type: "integer", value: token.value };
        }

        if (token.type === "IDENTIFIER") {
            consume();
            return { type: "variable", name: token.value };
        }

        // Handle unary minus (negative numbers)
        if (token.type === "OP" && token.value === "-") {
            consume();
            const next = peek();
            if (next?.type === "NUMBER") {
                consume();
                // Check for lookahead slash for negative fraction? -1/2
                if (peek()?.type === "SLASH") {
                    consume();
                    const den = consume();
                    if (den?.type !== "NUMBER" && den?.type !== "IDENTIFIER") throw new Error("Expected denominator");
                    return {
                        type: "fraction",
                        numerator: `-${next.value}`,
                        denominator: den.value
                    };
                }
                return { type: "integer", value: `-${next.value}` };
            }
            throw new Error("Unexpected token after unary minus");
        }

        if (token.type === "LPAREN") {
            consume();
            const expr = parseAddSub();
            if (peek()?.type !== "RPAREN") throw new Error("Expected )");
            consume();
            return expr;
        }

        // Mixed number token (custom type we might add in preprocess)
        if (token.type === "MIXED" as any) {
            consume();
            const parts = token.value.split("_"); // Hacky encoding
            return {
                type: "mixed",
                whole: parts[0],
                numerator: parts[1],
                denominator: parts[2]
            };
        }

        if (token.type === "COMMAND") {
            consume();
            if (token.value === "left") {
                const next = peek();
                if (next?.type === "LPAREN") {
                    consume(); // (
                    const expr = parseAddSub();
                    // Expect \right then RPAREN
                    const rightCmd = peek();
                    if (rightCmd?.type === "COMMAND" && rightCmd.value === "right") {
                        consume(); // \right
                        const rParen = peek();
                        if (rParen?.type === "RPAREN") {
                            consume(); // )
                            return expr; // Return inner expression, effectively ignoring \left( ... \right) wrapper
                        }
                        throw new Error("Expected ) after \\right");
                    }
                    throw new Error("Expected \\right after \\left(...)");
                }
                throw new Error(`Unsupported delimiter after \\left: ${next?.value}`);
            }
            if (token.value === "frac") {
                if (peek()?.type !== "LBRACE") throw new Error("Expected { after \\frac");
                consume(); // {
                const num = parseAddSub(); // Allow expressions in numerator
                if (peek()?.type !== "RBRACE") throw new Error("Expected } after numerator");
                consume(); // }

                if (peek()?.type !== "LBRACE") throw new Error("Expected { for denominator");
                consume(); // {
                const den = parseAddSub(); // Allow expressions in denominator
                if (peek()?.type !== "RBRACE") throw new Error("Expected } after denominator");
                consume(); // }

                // Check if simple fraction
                const isSimple = (num.type === "integer" || num.type === "variable") &&
                    (den.type === "integer" || den.type === "variable");



                if (isSimple) {
                    let simpleNum = "";
                    let simpleDen = "";
                    if (num.type === "integer") simpleNum = num.value;
                    else if (num.type === "variable") simpleNum = num.name;

                    if (den.type === "integer") simpleDen = den.value;
                    else if (den.type === "variable") simpleDen = den.name;

                    return {
                        type: "fraction",
                        numerator: simpleNum,
                        denominator: simpleDen
                    };
                } else {
                    return {
                        type: "binaryOp",
                        op: "/",
                        left: num,
                        right: den
                    };
                }
            }
            throw new Error(`Unknown command: \\${token.value}`);
        }

        throw new Error(`Unexpected token: ${token.value}`);
    }

    function parseMulDiv(): AstNode {
        let left = parsePrimary();

        while (true) {
            const token = peek();
            if (!token) break;

            // Handle standard * and / and :
            if (token.value === "*" || token.value === "/" || token.type === "COLON") {
                const opToken = consume()!;
                let opValue = opToken.value;

                // Normalize division tokens to "\div"
                if (opToken.type === "COLON" || opValue === "/") {
                    opValue = "\\div";
                }

                const right = parsePrimary();
                left = {
                    type: "binaryOp",
                    op: opValue as any,
                    left,
                    right
                };
                continue;
            }

            // Handle \div command
            if (token.type === "COMMAND" && token.value === "div") {
                consume(); // \div
                const right = parsePrimary();
                left = {
                    type: "binaryOp",
                    op: "\\div",
                    left,
                    right
                };
                continue;
            }

            // Handle \cdot and \times commands -> map to "*"
            if (token.type === "COMMAND" && (token.value === "cdot" || token.value === "times")) {
                consume(); // \cdot or \times
                const right = parsePrimary();
                left = {
                    type: "binaryOp",
                    op: "*",
                    left,
                    right
                };
                continue;
            }

            break;
        }
        return left;
    }

    function parseAddSub(): AstNode {
        let left = parseMulDiv();

        while (peek() && (peek()?.value === "+" || peek()?.value === "-")) {
            const op = consume()!;
            const right = parseMulDiv();
            left = {
                type: "binaryOp",
                op: op.value as any,
                left,
                right
            };
        }
        return left;
    }

    try {
        return parseAddSub();
    } catch (e) {
        console.error("Parse error:", e);
        return undefined;
    }
}

function preprocessMixedNumbers(tokens: Token[]): Token[] {
    const result: Token[] = [];
    let i = 0;

    while (i < tokens.length) {
        const t = tokens[i];

        // Check for Mixed Number: Num, Space, Num, Slash, Num
        if (t.type === "NUMBER") {
            const t1 = tokens[i + 1];
            const t2 = tokens[i + 2];
            const t3 = tokens[i + 3];
            const t4 = tokens[i + 4];

            if (t1?.type === "SPACE" &&
                t2?.type === "NUMBER" &&
                t3?.type === "SLASH" &&
                t4?.type === "NUMBER") {

                // Found mixed number!
                result.push({
                    type: "MIXED" as any,
                    value: `${t.value}_${t2.value}_${t4.value}`,
                    pos: t.pos
                });
                i += 5;
                continue;
            }
        }

        if (t.type !== "SPACE") {
            result.push(t);
        }
        i++;
    }

    return result;
}

// --- Path Traversal Helpers ---

export function getNodeAt(ast: AstNode, path: string): AstNode | undefined {
    if (path === "root" || path === "") return ast;

    const parts = path.split(".");
    let current: AstNode = ast;

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part === "root" || part === "") continue;

        // Handle fraction .num/.den virtual paths
        if (part === "num" || part === "den") {
            if (current.type !== "fraction") {
                return undefined; // .num/.den only valid on fraction nodes
            }
            const frac = current as FractionNode;
            const childValue = part === "num" ? frac.numerator : frac.denominator;

            // Check if the child is a simple integer string
            if (/^-?\d+$/.test(childValue)) {
                // Return a synthetic IntegerNode representing this fraction child
                return { type: "integer", value: childValue } as IntegerNode;
            }
            // Child is not a simple integer (could be an expression) - not targetable this way
            return undefined;
        }

        // Handle binaryOp term[0]/term[1]
        if (current.type === "binaryOp") {
            if (part === "term[0]") {
                current = current.left;
            } else if (part === "term[1]") {
                current = current.right;
            } else {
                return undefined;
            }
        } else if (current.type === "mixed") {
            return undefined;
        } else if (current.type === "fraction") {
            // Fraction without .num/.den - can only navigate via term[] if parent was binaryOp
            return undefined;
        } else {
            // integer or variable - can't navigate further
            return undefined;
        }
    }

    return current;
}

export function getNodeByOperatorIndex(ast: AstNode, targetIndex: number): { node: AstNode, path: string } | undefined {
    let currentIndex = 0;
    let found: { node: AstNode, path: string } | undefined;

    function traverse(node: AstNode, path: string) {
        if (found) return;

        const isOp = node.type === "binaryOp" || node.type === "fraction";

        if (node.type === "binaryOp") {
            traverse(node.left, path === "root" ? "term[0]" : `${path}.term[0]`);
            if (found) return;

            if (currentIndex === targetIndex) {
                found = { node, path };
                return;
            }
            currentIndex++;

            traverse(node.right, path === "root" ? "term[1]" : `${path}.term[1]`);
            return;
        }

        if (node.type === "fraction") {
            if (currentIndex === targetIndex) {
                found = { node, path };
                return;
            }
            currentIndex++;
            return;
        }

        if (node.type === "mixed") {
            if (currentIndex === targetIndex) {
                found = { node, path };
                return;
            }
            currentIndex++;
            return;
        }

        // integers are NOT operators - do not count them in operator index
        // (getNodeByOperatorIndex should only find binaryOp, fraction, mixed)
    }

    traverse(ast, "root");
    return found;
}

// --- Code Generation ---

export function toLatex(node: AstNode): string {
    if (node.type === "integer") {
        return node.value;
    }
    if (node.type === "fraction") {
        return `\\frac{${node.numerator}}{${node.denominator}}`;
    }
    if (node.type === "mixed") {
        return `${node.whole} \\frac{${node.numerator}}{${node.denominator}}`;
    }
    if (node.type === "binaryOp") {
        if (node.op === "/") {
            return `\\frac{${toLatex(node.left)}}{${toLatex(node.right)}}`;
        }

        const left = toLatex(node.left);
        const right = toLatex(node.right);

        const leftParen = shouldParen(node.op, node.left, false);
        const rightParen = shouldParen(node.op, node.right, true);

        const lStr = leftParen ? `(${left})` : left;
        const rStr = rightParen ? `(${right})` : right;

        // Convert * to \cdot for proper LaTeX rendering
        const opLatex = node.op === "*" ? "\\cdot" : node.op;
        return `${lStr} ${opLatex} ${rStr}`;
    }
    if (node.type === "variable") {
        return node.name;
    }
    return "";
}

/**
 * Convert AST to instrumented LaTeX with data-ast-id wrappers.
 * Uses \htmlData command for KaTeX to embed node IDs in DOM.
 * 
 * This is the AUTHORITATIVE source of truth for Stable-ID node IDs.
 * 
 * @param ast - The AST node to serialize
 * @param path - Current path in AST (default: "root")
 * @returns Instrumented LaTeX string with \htmlData wrappers
 */
export function toInstrumentedLatex(ast: AstNode, path: string = "root"): string {
    const escapeId = (id: string) => id.replace(/[\[\]{}\\]/g, '');

    const wrapNumber = (value: string, nodeId: string) => {
        const escaped = escapeId(nodeId);
        return `\\htmlData{ast-id=${escaped}, role=number}{${value}}`;
    };

    const wrapOperator = (op: string, nodeId: string) => {
        const escaped = escapeId(nodeId);
        const latexOp = op === "*" ? "\\cdot" : op;
        return `\\htmlData{ast-id=${escaped}, role=operator, operator=${op}}{${latexOp}}`;
    };

    const wrapFraction = (numLatex: string, denLatex: string, nodeId: string) => {
        const escaped = escapeId(nodeId);
        return `\\htmlData{ast-id=${escaped}, role=fraction}{\\frac{${numLatex}}{${denLatex}}}`;
    };

    if (ast.type === "integer") {
        return wrapNumber(ast.value, path);
    }

    if (ast.type === "fraction") {
        // Wrap numerator and denominator as numbers
        const numPath = `${path}.num`;
        const denPath = `${path}.den`;
        const num = wrapNumber(ast.numerator, numPath);
        const den = wrapNumber(ast.denominator, denPath);
        return wrapFraction(num, den, path);
    }

    if (ast.type === "mixed") {
        const wholePath = `${path}.whole`;
        const numPath = `${path}.num`;
        const denPath = `${path}.den`;
        const whole = wrapNumber(ast.whole, wholePath);
        const num = wrapNumber(ast.numerator, numPath);
        const den = wrapNumber(ast.denominator, denPath);
        return `${whole} ${wrapFraction(num, den, path)}`;
    }

    if (ast.type === "binaryOp") {
        const leftPath = path === "root" ? "term[0]" : `${path}.term[0]`;
        const rightPath = path === "root" ? "term[1]" : `${path}.term[1]`;

        if (ast.op === "/") {
            // Treat as fraction
            const num = toInstrumentedLatex(ast.left, leftPath);
            const den = toInstrumentedLatex(ast.right, rightPath);
            return wrapFraction(num, den, path);
        }

        const left = toInstrumentedLatex(ast.left, leftPath);
        const right = toInstrumentedLatex(ast.right, rightPath);
        const op = wrapOperator(ast.op, path);

        const leftParen = shouldParen(ast.op, ast.left, false);
        const rightParen = shouldParen(ast.op, ast.right, true);

        const lStr = leftParen ? `(${left})` : left;
        const rStr = rightParen ? `(${right})` : right;

        return `${lStr} ${op} ${rStr}`;
    }

    if (ast.type === "variable") {
        return ast.name; // Variables not wrapped for now
    }

    return "";
}

function shouldParen(parentOp: string, child: AstNode, isRightChild: boolean): boolean {
    if (child.type !== "binaryOp") return false;
    const childOp = child.op;

    const prec = (op: string) => {
        if (op === "*" || op === "/" || op === "\\div") return 2;
        if (op === "+" || op === "-") return 1;
        return 0;
    };

    const pPrec = prec(parentOp);
    const cPrec = prec(childOp);

    if (cPrec < pPrec) return true;

    if (cPrec === pPrec) {
        if (isRightChild) {
            if (parentOp === "-" || parentOp === "/") return true;
        }
        return false;
    }
    return false;
}

export function replaceNodeAt(ast: AstNode, path: string, newNode: AstNode): AstNode {
    if (path === "root" || path === "") return newNode;

    const parts = path.split(".");

    function update(node: AstNode, parts: string[]): AstNode {
        if (parts.length === 0) return newNode;

        const part = parts[0];
        // Handle empty parts from split if any (e.g. "term[0]..term[1]")
        if (part === "") return update(node, parts.slice(1));

        const remaining = parts.slice(1);

        // Handle fraction .num/.den virtual paths
        if (part === "num" || part === "den") {
            if (node.type !== "fraction") {
                console.warn(`[replaceNodeAt] Cannot apply .${part} to non-fraction node`);
                return node;
            }
            // For fraction children, we convert the string to the new node
            // The new node should be a fraction when applying INT_TO_FRAC
            // We need to convert it to a latex string for the fraction child
            const frac = node as FractionNode;
            if (remaining.length === 0) {
                // Replace the child - convert newNode back to LaTeX for the fraction child
                const childLatex = toLatex(newNode);
                if (part === "num") {
                    return { ...frac, numerator: childLatex };
                } else {
                    return { ...frac, denominator: childLatex };
                }
            }
            // Nested path into .num/.den - not supported
            return node;
        }

        if (node.type === "binaryOp") {
            if (part === "term[0]") {
                return { ...node, left: update(node.left, remaining) };
            } else if (part === "term[1]") {
                return { ...node, right: update(node.right, remaining) };
            }
        }
        return node;
    }

    return update(ast, parts.filter(p => p !== "root" && p !== ""));
}

