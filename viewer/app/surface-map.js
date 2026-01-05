// surface-map.js
// Строит SurfaceNodeMap по уже отрендеренному KaTeX-HTML.
//
// Модель поверх DOM: нас интересуют только семантические элементы —
// числа, переменные, знаки, скобки, дробные черты и т.п.

import { buildASTFromLatex, enumerateOperators, enumerateIntegers } from "./ast-parser.js";

function toRelativeBox(el, containerBox) {
  const r = el.getBoundingClientRect();
  return {
    left: r.left - containerBox.left,
    top: r.top - containerBox.top,
    right: r.right - containerBox.left,
    bottom: r.bottom - containerBox.top,
  };
}

function isStructuralClass(className) {
  // Классы, которые используются KaTeX только для верстки,
  // но не несут математического смысла.
  return (
    className === "vlist" ||
    className === "vlist-t" ||
    className === "vlist-r" ||
    className === "vbox" ||
    className === "pstrut" ||
    className === "sizing" ||
    className === "fontsize-ensurer" ||
    className === "mspace"
  );
}

function isStructural(classes) {
  return classes.some(isStructuralClass);
}

const OP_CHARS = "+-−*/:⋅·×÷";

function hasOperatorChar(text) {
  const t = text || "";
  for (let i = 0; i < t.length; i++) {
    if (OP_CHARS.includes(t[i])) return true;
  }
  return false;
}

function hasDigitChar(text) {
  return /[0-9]/.test(text || "");
}

function classifyElement(el, classes, text) {
  const t = (text || "").trim();
  const hasDigit = /[0-9]/.test(t);
  const hasGreekChar = /[\u0370-\u03FF\u1F00-\u1FFF]/.test(t);
  const hasAsciiLetter = /[A-Za-z]/.test(t);
  const hasOpChar = hasOperatorChar(t);


  // --- ЧИСЛА И ПЕРЕМЕННЫЕ ---

  // Любая последовательность цифр считаем числом, независимо от KaTeX‑классов.
  if (/^[0-9]+$/.test(t)) {
    return { kind: "Num", role: "operand", idPrefix: "num", atomic: true };
  }

  // Десятичные числа вида 12.5, 0.75, 3.125 тоже считаем одним числом.
  if (/^[0-9]+\.[0-9]+$/.test(t)) {
    return { kind: "Num", role: "operand", idPrefix: "num", atomic: true };
  }

  // Одиночная латинская буква — переменная.
  if (/^[A-Za-z]$/.test(t)) {
    return { kind: "Var", role: "operand", idPrefix: "var", atomic: true };
  }

  // Одиночная греческая буква — тоже переменная.
  if (/^[\u0370-\u03FF\u1F00-\u1FFF]$/.test(t)) {
    return { kind: "Var", role: "operand", idPrefix: "var", atomic: true };
  }

  // --- БИНАРНЫЕ ОПЕРАТОРЫ ---

  // Одиночный символ‑оператор.
  // Поддерживаем как ASCII, так и типичные Unicode варианты KaTeX (⋅, ·, ×, −, ÷).
  const opChars = "+-−*/:⋅·×÷";
  if (t.length === 1 && opChars.includes(t)) {
    console.log("[DEBUG] classifyElement found op:", t);
    return { kind: "BinaryOp", role: "operator", idPrefix: "op", atomic: true };
  }

  // Бинарные операторы / отношения по KaTeX‑классам.
  if (classes.includes("mbin")) {
    return { kind: "BinaryOp", role: "operator", idPrefix: "op", atomic: true };
  }
  if (classes.includes("mrel")) {
    return { kind: "Relation", role: "operator", idPrefix: "rel", atomic: true };
  }

  // --- СКОБКИ ---

  // Явные скобки по тексту.
  if (t === "(" || t === "[" || t === "{") {
    return { kind: "ParenOpen", role: "decorator", idPrefix: "paren", atomic: true };
  }
  if (t === ")" || t === "]" || t === "}") {
    return { kind: "ParenClose", role: "decorator", idPrefix: "paren", atomic: true };
  }

  // Скобки по KaTeX‑классам.
  if (classes.includes("mopen")) {
    return { kind: "ParenOpen", role: "decorator", idPrefix: "paren", atomic: true };
  }
  if (classes.includes("mclose")) {
    return { kind: "ParenClose", role: "decorator", idPrefix: "paren", atomic: true };
  }

  // --- ДРОБИ ---

  // Дробная черта.
  if (classes.includes("frac-line")) {
    return { kind: "FracBar", role: "decorator", idPrefix: "fracbar", atomic: true };
  }

  // Контейнер дроби.
  if (classes.includes("mfrac")) {
    return { kind: "Fraction", role: "operator", idPrefix: "frac", atomic: false };
  }

  // --- ОБОБЩЁННАЯ СТРАХОВКА ДЛЯ ЧИСЕЛ И ГРЕЧЕСКИХ БУКВ ---

  // Если в элементе есть греческая буква, а до этого он не был
  // распознан как более специфичный узел — считаем его переменной.
  if (hasGreekChar) {
    return { kind: "Var", role: "operand", idPrefix: "var", atomic: true };
  }

  // Если есть хотя бы одна цифра и нет латинских/греческих букв —
  // считаем элемент числом (покрывает "странные" decimal-случаи KaTeX).
  if (hasDigit && !hasAsciiLetter && !hasGreekChar && !hasOpChar) {
    return { kind: "Num", role: "operand", idPrefix: "num", atomic: true };
  }

  // --- ФОЛБЭК ---

  // Всё остальное считаем "группой/контейнером" без собственной атомарности.
  return { kind: "Other", role: "group", idPrefix: "node", atomic: false };
}

/**
 * Segment mixed content (e.g., "2*5") into individual tokens.
 * Returns array of {type, text} objects where type is "num", "op", or "other".
 */
function segmentMixedContent(text) {
  const segments = [];
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    // Skip whitespace
    if (/\s/.test(char)) {
      i++;
      continue;
    }

    // Number segment (including decimals)
    if (/\d/.test(char)) {
      let numText = char;
      i++;
      while (i < text.length && (/\d/.test(text[i]) || text[i] === '.')) {
        numText += text[i];
        i++;
      }
      segments.push({ type: "num", text: numText });
      continue;
    }

    // Operator segment
    if (OP_CHARS.includes(char)) {
      segments.push({ type: "op", text: char });
      i++;
      continue;
    }

    // Variable or other single character
    if (/[A-Za-z]/.test(char)) {
      segments.push({ type: "var", text: char });
      i++;
      continue;
    }

    // Greek or other unicode
    if (/[\u0370-\u03FF\u1F00-\u1FFF]/.test(char)) {
      segments.push({ type: "var", text: char });
      i++;
      continue;
    }

    // Unknown - skip
    i++;
  }

  return segments;
}

/**
 * Create an interpolated bounding box for a segment within a parent element.
 * Divides the parent's width equally among all segments.
 */
function interpolateBBox(parentBBox, segmentIndex, totalSegments) {
  const width = parentBBox.right - parentBBox.left;
  const segmentWidth = width / totalSegments;

  return {
    left: parentBBox.left + (segmentIndex * segmentWidth),
    top: parentBBox.top,
    right: parentBBox.left + ((segmentIndex + 1) * segmentWidth),
    bottom: parentBBox.bottom
  };
}


function isAtomicKind(kind) {
  return (
    kind === "Num" ||
    kind === "Var" ||
    kind === "BinaryOp" ||
    kind === "Relation" ||
    kind === "ParenOpen" ||
    kind === "ParenClose" ||
    kind === "FracBar"
  );
}

// Основная функция: строит карту узлов
export function buildSurfaceNodeMap(containerElement) {
  const bases = containerElement.querySelectorAll(".katex-html .base");
  const containerBox = containerElement.getBoundingClientRect();

  const atoms = [];
  const byElement = new Map();
  let idCounter = 0;
  const nextId = (prefix) => `${prefix}-${(++idCounter).toString(36)}`;

  const rootNode = {
    id: "root",
    kind: "Root",
    role: "root",
    bbox: {
      left: 0,
      top: 0,
      right: containerBox.width,
      bottom: containerBox.height,
    },
    dom: containerElement,
    latexFragment: "",
    children: [],
    parent: null,
  };

  function traverse(element, parentNode) {
    const classes = Array.from(element.classList || []);
    const text = (element.textContent || "").trim();

    // Прозрачные версточные обертки: не создаем узел, проходим к детям
    if (isStructural(classes)) {
      Array.from(element.children || []).forEach((child) =>
        traverse(child, parentNode)
      );
      return;
    }

    const mixedNumAndOp =
      hasDigitChar(text) && hasOperatorChar(text);

    if (mixedNumAndOp) {
      // If element has children, descend into them (KaTeX structured it properly)
      if (element.children && element.children.length > 0) {
        Array.from(element.children).forEach((child) =>
          traverse(child, parentNode)
        );
        return;
      }

      // No children - this is a leaf node with mixed content like "2*5"
      // Segment it character-by-character and create synthetic nodes
      console.log("[SurfaceMap] Segmenting mixed content:", text);
      const segments = segmentMixedContent(text);
      const bbox = toRelativeBox(element, containerBox);

      segments.forEach((segment, idx) => {
        const segmentBBox = interpolateBBox(bbox, idx, segments.length);

        let kind, role, idPrefix, atomic;
        if (segment.type === "num") {
          kind = "Num";
          role = "operand";
          idPrefix = "num";
          atomic = true;
        } else if (segment.type === "op") {
          kind = "BinaryOp";
          role = "operator";
          idPrefix = "op";
          atomic = true;
        } else if (segment.type === "var") {
          kind = "Var";
          role = "operand";
          idPrefix = "var";
          atomic = true;
        } else {
          kind = "Other";
          role = "group";
          idPrefix = "node";
          atomic = false;
        }

        const syntheticNode = {
          id: nextId(idPrefix),
          kind,
          role,
          bbox: segmentBBox,
          dom: element, // Share parent DOM element
          latexFragment: segment.text,
          children: [],
          parent: parentNode,
          synthetic: true // Mark as synthetic for debugging
        };

        if (parentNode) {
          parentNode.children.push(syntheticNode);
        }

        // Note: Last segment wins for byElement lookup
        // This is OK because hit-testing uses bounding boxes
        byElement.set(element, syntheticNode);

        if (atomic && segment.text.trim().length > 0) {
          atoms.push(syntheticNode);
          console.log("[SurfaceMap] Created synthetic atom:", syntheticNode.kind, syntheticNode.latexFragment);
        }
      });

      return; // Done processing this mixed element
    }

    const info = classifyElement(element, classes, text);

    // Элемент без размера не используем как отдельный узел,
    // но продолжаем обходить детей
    const bbox = toRelativeBox(element, containerBox);
    const width = bbox.right - bbox.left;
    const height = bbox.bottom - bbox.top;
    const hasSize = width > 0.5 && height > 0.5;

    // Если это "Other" без текста и/или без размера, считаем его прозрачным
    if (info.kind === "Other" && (!text || !hasSize)) {
      Array.from(element.children || []).forEach((child) =>
        traverse(child, parentNode)
      );
      return;
    }

    // Создаем узел
    const node = {
      id: nextId(info.idPrefix),
      kind: info.kind,
      role: info.role,
      bbox,
      dom: element,
      latexFragment: text,
      children: [],
      parent: parentNode,
    };

    if (parentNode) {
      parentNode.children.push(node);
    }

    byElement.set(element, node);

    // Решаем, добавлять ли узел в список интерактивных атомов.
    // Базовый признак атомарности: либо classifyElement пометил atomic,
    // либо тип узла один из "атомарных" (Num, Var, BinaryOp, Relation, Paren*, FracBar).
    const hasText = (node.latexFragment || "").trim().length > 0;
    const isAtomic = info.atomic || isAtomicKind(node.kind);

    // Для большинства атомов требуем осмысленный текст (символ виден пользователю).
    // Единственное исключение — FracBar: у KaTeX дробная черта не имеет текстового содержимого,
    // но для нас она должна быть кликабельной и интерактивной.
    if (isAtomic) {
      if (node.kind === "FracBar" || hasText) {
        atoms.push(node);
      }
    }

    // Рекурсивно обходим детей уже как потомков этого узла
    Array.from(element.children || []).forEach((child) =>
      traverse(child, node)
    );
  }

  if (bases && bases.length) {
    bases.forEach((b) => traverse(b, rootNode));
  }

  return {
    root: rootNode,
    atoms,
    byElement,
  };
}

/**
 * Maps various Unicode operator glyphs to canonical ASCII operators.
 * Ensures consistent matching between AST (ASCII) and Surface (Unicode).
 * @param {string} ch - The character or string to normalize.
 * @returns {string} Normalized operator or original string.
 */
function normalizeOpSymbol(ch) {
  const s = (ch || "").trim();
  // Multiplication: *, × (U+00D7), · (U+00B7), ⋅ (U+22C5), ∗ (U+2217)
  if (s === "*" || s === "×" || s === "·" || s === "⋅" || s === "∗") return "*";
  // Subtraction: -, − (U+2212)
  if (s === "-" || s === "−") return "-";
  // Division: /, ÷ (U+00F7), : (ASCII colon)
  if (s === "/" || s === "÷" || s === ":") return "/";
  // Addition: + (usually fine, but good to be explicit if variants appear)
  if (s === "+") return "+";

  return s;
}

// Сериализация карты в JSON-дружелюбный вид
export function surfaceMapToSerializable(map) {
  function toPlain(node) {
    return {
      id: node.id,
      kind: node.kind,
      role: node.role,
      operatorIndex: typeof node.operatorIndex === "number" ? node.operatorIndex : undefined,
      bbox: node.bbox,
      latexFragment: node.latexFragment,
      children: node.children.map(toPlain),
    };
  }

  return {
    root: toPlain(map.root),
  };
}

// Простой hit-test по атомарным узлам.
// clientX/clientY — координаты из PointerEvent/MouseEvent.
export function hitTestPoint(map, clientX, clientY, containerElement) {
  const cbox = containerElement.getBoundingClientRect();
  const x = clientX - cbox.left;
  const y = clientY - cbox.top;

  const candidates = map.atoms.filter((node) => {
    let b = node.bbox;

    // FIX: Expand hit-test area for operators vertically
    // Operators between fractions have small vertical bbox that doesn't match visual position
    if (node.role === "operator") {
      const expandY = 10; // px expansion up and down
      b = {
        left: b.left,
        right: b.right,
        top: b.top - expandY,
        bottom: b.bottom + expandY
      };
    }

    return x >= b.left && x <= b.right && y >= b.top && y <= b.bottom;
  });

  if (candidates.length === 0) return null;

  // выбираем самый "мелкий" по площади — хороший прокси для "самый глубокий"
  candidates.sort((a, b) => {
    const areaA = (a.bbox.right - a.bbox.left) * (a.bbox.bottom - a.bbox.top);
    const areaB = (b.bbox.right - b.bbox.left) * (b.bbox.bottom - b.bbox.top);
    return areaA - areaB;
  });

  return candidates[0];
}

// --- Enhancements: classification refinement & UX helpers ---
/**
 * Post-process the surface map to (1) broaden FracBar hit area,
 * (2) tag greek letters as Var, (3) detect decimals,
 * (4) distinguish unary vs binary minus, (5) mark mixed numbers (Num followed by Fraction).
 * This does not change DOM; it updates node.kind and bbox in-place.
 * @param {{root:any, atoms:any[], byElement:Map}} map
 * @param {HTMLElement} containerEl
 */
export function enhanceSurfaceMap(map, containerEl) {
  if (!map || !Array.isArray(map.atoms)) return map;
  const cbox = containerEl.getBoundingClientRect();
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // 1) Broaden frac bar hit-zone for easier selection
  for (const n of map.atoms) {
    if (n.kind === "FracBar" && n.bbox) {
      const expand = 3; // px up/down
      n.bbox.top = clamp(n.bbox.top - expand, 0, cbox.height);
      n.bbox.bottom = clamp(n.bbox.bottom + expand, 0, cbox.height);
    }
  }

  // Helpers
  const isGreek = (s) => /[\u0370-\u03FF\u1F00-\u1FFF]/.test((s || "").trim());
  const isDecimal = (s) => /^\d+\.\d+$/.test((s || "").trim());
  const midY = (b) => (b.top + b.bottom) / 2;
  const height = (b) => Math.max(0, b.bottom - b.top);

  // Prepare left-to-right ordering (stable)
  const atomsSorted = [...map.atoms].sort((a, b) => (a.bbox.left - b.bbox.left) || (a.bbox.top - b.bbox.top));

  // 2) Greek as Var, 3) Decimals as Decimal
  for (const n of atomsSorted) {
    const t = (n.latexFragment || "").trim();
    if (isGreek(t)) n.kind = "Var";
    if (isDecimal(t)) n.kind = "Decimal";
  }

  // 4) Unary vs Binary minus (heuristic by nearest left neighbor with vertical overlap)
  for (let i = 0; i < atomsSorted.length; i++) {
    const n = atomsSorted[i];
    const t = (n.latexFragment || "").trim();
    if (t === "-" || t === "−") {
      let prev = null;
      for (let j = i - 1; j >= 0; j--) {
        const p = atomsSorted[j];
        const overlap = Math.min(n.bbox.bottom, p.bbox.bottom) - Math.max(n.bbox.top, p.bbox.top);
        const minH = Math.min(height(n.bbox), height(p.bbox));
        if (overlap > 0.25 * minH) { prev = p; break; }
      }
      const prevIsOperator = !prev || ["BinaryOp", "Relation", "ParenOpen", "FracBar", "Operator"].includes(prev?.kind);
      n.kind = prevIsOperator ? "MinusUnary" : "MinusBinary";
    }
  }

  // 5) Mixed numbers: mark number immediately followed (left-to-right) by a close FracBar on the same baseline as MixedNumber
  for (let i = 0; i < atomsSorted.length; i++) {
    const n = atomsSorted[i];
    if (n.kind === "Num" || n.kind === "Decimal") {
      const right = n.bbox.right;
      const myY = midY(n.bbox);
      const candidate = atomsSorted.find(m =>
        m.kind === "FracBar" &&
        m.bbox.left > right &&
        (m.bbox.left - right) < 22 &&
        m.bbox.top < myY && m.bbox.bottom > myY
      );
      if (candidate) {
        n.kind = "MixedNumber";
        n.meta = Object.assign({}, n.meta || {}, { mixedWithFracBarId: candidate.id });
      }
    }
  }


  // 6) Assign linear operatorIndex to operator-like nodes (for TSA)
  // We consider BinaryOp, MinusBinary, Relation and Fraction as operator slots.
  {
    let opIndex = 0;
    for (const n of atomsSorted) {
      const k = n.kind;
      const isOperatorSlot =
        k === "BinaryOp" ||
        k === "MinusBinary" ||
        k === "Relation" ||
        k === "Fraction";
      if (isOperatorSlot) {
        n.operatorIndex = opIndex++;
      }
    }
  }
  return map;
}

/**
 * NEW: Correlate surface map numbers (Num nodes) with AST integer node IDs.
 * This enables accurate integer targeting for P1 click-cycle feature.
 * @param {{root:any, atoms:any[], byElement:Map}} map - Surface map
 * @param {string} latex - LaTeX expression
 * @returns {{root:any, atoms:any[], byElement:Map}} Enhanced map
 */
export function correlateIntegersWithAST(map, latex) {
  if (!map || !Array.isArray(map.atoms) || !latex) return map;

  // 1. Build AST from LaTeX
  const ast = buildASTFromLatex(latex);
  if (!ast) {
    console.warn("[SurfaceMap] Failed to parse LaTeX for integer correlation:", latex);
    return map;
  }

  // 2. Enumerate integers in AST (in-order traversal)
  const astIntegers = enumerateIntegers(ast);

  // 3. Collect surface numbers in left-to-right order
  // IMPORTANT: KaTeX surface maps often contain nested Num nodes (e.g. Num -> Num).
  // We want the *leaf* Num nodes because hit-testing usually returns the deepest node.
  // Then we propagate the matched astNodeId upward so both leaf and parent Num nodes are clickable.
  const parentByChild = new Map();
  for (const n of map.atoms) {
    if (!n || !Array.isArray(n.children)) continue;
    for (const ch of n.children) parentByChild.set(ch, n);
  }

  const allNums = map.atoms.filter(n => n && n.kind === "Num");
  const leafNums = allNums.filter(n => !(Array.isArray(n.children) && n.children.some(ch => ch && ch.kind === "Num")));

  const surfaceNumbers = leafNums
    .sort((a, b) => (a.bbox.left - b.bbox.left) || (a.bbox.top - b.bbox.top));
  console.log("=== [SURFACE-NUMS] Integer correlation ===");
  console.log(`[SURFACE-NUMS] Expression: "${latex}"`);
  console.log(`[SURFACE-NUMS] AST integers: ${astIntegers.length}, Surface nums: ${surfaceNumbers.length}`);

  // Dump all AST integers for debugging
  console.log("[AST-NUMS] All AST integers:");
  astIntegers.forEach((ai, idx) => {
    console.log(`  [AST-NUMS] [${idx}] nodeId="${ai.nodeId}" value=${ai.value}`);
  });

  // Dump all surface numbers for debugging
  console.log("[SURFACE-NUMS] All surface numbers:");
  surfaceNumbers.forEach((sn, idx) => {
    console.log(`  [SURFACE-NUMS] [${idx}] surfaceId="${sn.id}" text="${sn.text || sn.latexFragment}" kind=${sn.kind} bbox=(${Math.round(sn.bbox.left)},${Math.round(sn.bbox.top)})`);
  });

  // 4. Match by position (1-to-1) and inject data-ast-id into DOM
  const count = Math.min(astIntegers.length, surfaceNumbers.length);
  for (let i = 0; i < count; i++) {
    const astInt = astIntegers[i];
    const surfNum = surfaceNumbers[i];

    surfNum.astNodeId = astInt.nodeId;
    surfNum.astIntegerValue = astInt.value;

    // STABLE-ID: Inject data-ast-id and data-role into DOM element
    if (surfNum.dom) {
      surfNum.dom.setAttribute('data-ast-id', astInt.nodeId);
      surfNum.dom.setAttribute('data-role', 'number');
    }

    // Propagate astNodeId upward through nested Num nodes (Num -> Num)
    let p = parentByChild.get(surfNum);
    while (p && p.kind === "Num") {
      if (!p.astNodeId) p.astNodeId = astInt.nodeId;
      if (p.astIntegerValue == null) p.astIntegerValue = astInt.value;
      // Also set on parent DOM
      if (p.dom && !p.dom.hasAttribute('data-ast-id')) {
        p.dom.setAttribute('data-ast-id', astInt.nodeId);
        p.dom.setAttribute('data-role', 'number');
      }
      p = parentByChild.get(p);
    }


    console.log(`[SURFACE-NUMS] MATCHED: surface[${i}] "${surfNum.text || surfNum.latexFragment}" (id=${surfNum.id}) -> AST nodeId="${astInt.nodeId}" value=${astInt.value} [DOM injected]`);
  }

  return map;
}

/**
 * Correlate surface map operators with AST node IDs.
 * This enables accurate operator-to-nodeId mapping for the backend.
 * @param {{root:any, atoms:any[], byElement:Map}} map - Surface map
 * @param {string} latex - LaTeX expression
 * @returns {{root:any, atoms:any[], byElement:Map}} Enhanced map
 */
export function correlateOperatorsWithAST(map, latex) {
  if (!map || !Array.isArray(map.atoms) || !latex) return map;

  // 1. Build AST from LaTeX
  const ast = buildASTFromLatex(latex);
  if (!ast) {
    console.warn("[SurfaceMap] Failed to parse LaTeX for AST correlation:", latex);
    return map;
  }

  // 2. Enumerate operators in AST (in-order traversal)
  // These are the "truth" for the backend execution.
  const astOperators = enumerateOperators(ast);

  // 3. Collect surface operators in left-to-right order (visual)
  // We trust that KaTeX renders them in logical order for linear expressions.
  const surfaceOperators = map.atoms
    .filter(n => {
      const k = n.kind;
      return k === "BinaryOp" || k === "MinusBinary" || k === "Relation";
    })
    .sort((a, b) => (a.bbox.left - b.bbox.left) || (a.bbox.top - b.bbox.top));

  const DEBUG = true; // Keep debug on for diagnostic purposes

  // DIAGNOSTIC LOGGING: AST Operators
  console.log("=== [AST-OPS] Operator sequence from AST ===");
  astOperators.forEach((op, idx) => {
    console.log(`[AST-OPS] index=${idx} op="${op.operator}" nodeId="${op.nodeId}" position=${op.position}`);
  });

  // DIAGNOSTIC LOGGING: Surface Operators (before correlation)
  console.log("=== [SURFACE-OPS] Operator sequence from Surface Map (before correlation) ===");
  surfaceOperators.forEach((op, idx) => {
    console.log(`[SURFACE-OPS] index=${idx} op="${op.latexFragment}" surfaceId="${op.id}" bbox.left=${Math.round(op.bbox.left)} operatorIndex=${op.operatorIndex} astNodeId=${op.astNodeId || "NOT_SET"}`);
  });

  // 4. Match surface operators to AST operators
  // We match by "grouping by symbol" to avoid mistakenly matching a '+' to a '*' if counts align but types don't.
  // We use normalizeOpSymbol for both sides to ensure "∗" matches "*".

  // Group AST operators by normalized symbol
  const astBySymbol = {};
  astOperators.forEach(op => {
    const raw = op.operator;
    const sym = normalizeOpSymbol(raw);
    console.log(`[DEBUG-NORM] AST: raw="${raw}" (U+${raw.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}) => normalized="${sym}"`);
    if (!astBySymbol[sym]) astBySymbol[sym] = [];
    astBySymbol[sym].push(op);
  });

  // Group Surface operators by normalized symbol
  const surfaceBySymbol = {};
  surfaceOperators.forEach(op => {
    const raw = op.latexFragment;
    const sym = normalizeOpSymbol(raw);
    console.log(`[DEBUG-NORM] Surface: raw="${raw}" (U+${raw.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}) => normalized="${sym}"`);
    if (!surfaceBySymbol[sym]) surfaceBySymbol[sym] = [];
    surfaceBySymbol[sym].push(op);
  });

  // Match each group
  console.log("=== [SURFACE-OPS] Correlating surface operators with AST ===");
  // Iterate over keys from both sets to handle potential mismatches gracefully
  const allSymbols = new Set([...Object.keys(astBySymbol), ...Object.keys(surfaceBySymbol)]);

  for (const sym of allSymbols) {
    const astOps = astBySymbol[sym] || [];
    const surfOps = surfaceBySymbol[sym] || [];

    console.log(`[SURFACE-OPS] Matching symbol "${sym}": ${astOps.length} AST ops, ${surfOps.length} surface ops`);

    // Match 1-to-1 in order
    const count = Math.min(astOps.length, surfOps.length);
    for (let i = 0; i < count; i++) {
      const astOp = astOps[i];
      const surfOp = surfOps[i];

      surfOp.astNodeId = astOp.nodeId;
      surfOp.astOperator = astOp.operator;

      // STABLE-ID: Inject data-ast-id and data-role into DOM element
      if (surfOp.dom) {
        surfOp.dom.setAttribute('data-ast-id', astOp.nodeId);
        surfOp.dom.setAttribute('data-role', 'operator');
        surfOp.dom.setAttribute('data-operator', astOp.operator);
      }

      // CRITICAL FIX: Compute LOCAL operator index within the AST node
      // For binary operators, the local index is typically 0 or 1
      // We need to count how many operators with the same nodeId we've seen before this one
      const sameNodeOps = astOps.filter((op, idx) => idx < i && op.nodeId === astOp.nodeId);
      surfOp.astOperatorIndex = sameNodeOps.length;

      console.log(`[SURFACE-OPS]   Matched: surface[${i}] "${surfOp.latexFragment}" (${surfOp.id}) -> AST nodeId="${astOp.nodeId}" localIndex=${surfOp.astOperatorIndex} [DOM injected]`);
    }
  }

  // DIAGNOSTIC LOGGING: Surface Operators (after correlation)
  console.log("=== [SURFACE-OPS] Final operator sequence (after correlation) ===");
  surfaceOperators.forEach((op, idx) => {
    const astLocal = typeof op.astOperatorIndex === "number" ? op.astOperatorIndex : "?";
    console.log(`[SURFACE-OPS] index=${idx} op="${op.latexFragment}" surfaceId="${op.id}" astNodeId="${op.astNodeId || "UNMATCHED"}" astLocalIndex=${astLocal} globalIndex=${op.operatorIndex}`);
  });

  return map;
}

/**
 * DEV ASSERTION: Scan atoms and verify that all interactive elements have data-ast-id.
 * Logs a summary error if any are missing.
 * @param {{root:any, atoms:any[], byElement:Map}} map - Surface map
 */
export function assertStableIdInjection(map) {
  if (!map || !Array.isArray(map.atoms)) return;

  const missing = [];

  for (const atom of map.atoms) {
    if (!atom.dom) continue;

    // Check if this atom should have data-ast-id
    const kind = atom.kind || "";
    const isInteractive = kind === "Num" || kind === "BinaryOp" || kind === "MinusBinary" || kind === "Relation";

    if (isInteractive && !atom.dom.hasAttribute('data-ast-id')) {
      missing.push({
        id: atom.id,
        kind: atom.kind,
        text: atom.latexFragment || atom.dom.textContent
      });
    }
  }

  if (missing.length > 0) {
    const first3 = missing.slice(0, 3).map(m => `${m.kind}:"${m.text}" (${m.id})`).join(", ");
    console.error(`[STABLE-ID ASSERTION] ${missing.length} interactive element(s) missing data-ast-id: ${first3}${missing.length > 3 ? "..." : ""}`);
  } else {
    console.log(`[STABLE-ID ASSERTION] All ${map.atoms.filter(a => a.dom && (a.kind === "Num" || a.kind === "BinaryOp" || a.kind === "Relation")).length} interactive elements have data-ast-id`);
  }
}

/**
 * Find operand surface nodes for a given operator AST path.
 * Used by Smart Operator Selection to find visual elements for highlighting.
 * 
 * Given an operator at path "root" with children at "term[0]" and "term[1]",
 * or an operator at "term[1]" with children at "term[1].term[0]" and "term[1].term[1]",
 * this function finds the corresponding surface nodes.
 * 
 * @param {{root:any, atoms:any[], byElement:Map}} surfaceMap - Surface map
 * @param {string} operatorAstPath - AST path of the operator (e.g., "root", "term[1]")
 * @returns {{left: Object|null, right: Object|null}|null} Operand surface nodes or null
 */
export function getOperandNodes(surfaceMap, operatorAstPath) {
  if (!surfaceMap || !Array.isArray(surfaceMap.atoms) || !operatorAstPath) {
    return null;
  }

  // Compute child paths based on operator path
  let leftPath, rightPath;

  if (operatorAstPath === "root") {
    // Root operator: children are "term[0]" and "term[1]"
    leftPath = "term[0]";
    rightPath = "term[1]";
  } else {
    // Nested operator: children are "operatorPath.term[0]" and "operatorPath.term[1]"
    leftPath = `${operatorAstPath}.term[0]`;
    rightPath = `${operatorAstPath}.term[1]`;
  }

  console.log(`[getOperandNodes] Looking for operands: left="${leftPath}", right="${rightPath}"`);

  // Find surface nodes with matching astNodeId
  // Note: astNodeId might be on the operator itself, or on a child that represents the operand
  // We need to find atoms whose astNodeId starts with the expected path

  let leftNode = null;
  let rightNode = null;

  // Strategy 1: Exact match on astNodeId
  for (const atom of surfaceMap.atoms) {
    if (!atom.astNodeId) continue;

    // Check for exact match or prefix match (for nested structures)
    if (atom.astNodeId === leftPath || atom.astNodeId.startsWith(leftPath + ".")) {
      // Prefer exact match, but track any match
      if (atom.astNodeId === leftPath || !leftNode) {
        leftNode = atom;
      }
    }
    if (atom.astNodeId === rightPath || atom.astNodeId.startsWith(rightPath + ".")) {
      if (atom.astNodeId === rightPath || !rightNode) {
        rightNode = atom;
      }
    }
  }

  // Strategy 2: If no exact match, find by position relative to operator
  // This is a fallback for cases where AST paths don't align perfectly
  if (!leftNode || !rightNode) {
    // Find the operator node by its path
    const operatorNode = surfaceMap.atoms.find(a => a.astNodeId === operatorAstPath);

    if (operatorNode && operatorNode.bbox) {
      const opCenter = (operatorNode.bbox.left + operatorNode.bbox.right) / 2;
      const opMidY = (operatorNode.bbox.top + operatorNode.bbox.bottom) / 2;

      // Find operand-like nodes on the same baseline
      const operandCandidates = surfaceMap.atoms.filter(a => {
        if (a === operatorNode) return false;
        if (!a.bbox) return false;

        // Must be operand-like
        const isOperand = a.kind === "Num" || a.kind === "Var" ||
          a.kind === "Fraction" || a.kind === "Decimal" ||
          a.kind === "MixedNumber";
        if (!isOperand) return false;

        // Must be on similar baseline (vertical overlap)
        const aMidY = (a.bbox.top + a.bbox.bottom) / 2;
        const vertOverlap = Math.abs(aMidY - opMidY) < 20; // Allow some variance

        return vertOverlap;
      });

      if (!leftNode) {
        // Find closest operand to the LEFT of operator
        const leftCandidates = operandCandidates.filter(a => a.bbox.right <= opCenter);
        if (leftCandidates.length > 0) {
          leftNode = leftCandidates.sort((a, b) => b.bbox.right - a.bbox.right)[0];
        }
      }

      if (!rightNode) {
        // Find closest operand to the RIGHT of operator
        const rightCandidates = operandCandidates.filter(a => a.bbox.left >= opCenter);
        if (rightCandidates.length > 0) {
          rightNode = rightCandidates.sort((a, b) => a.bbox.left - b.bbox.left)[0];
        }
      }
    }
  }

  console.log(`[getOperandNodes] Found: left=${leftNode?.id || "null"} (${leftNode?.kind}), right=${rightNode?.id || "null"} (${rightNode?.kind})`);

  return {
    left: leftNode,
    right: rightNode,
  };
}

