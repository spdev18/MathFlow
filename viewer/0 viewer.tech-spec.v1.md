# Viewer Technical Specification (v1)

> **Scope:** This document defines the responsibilities, invariants, and event
> contracts of the **Viewer** layer in FinalMath.  
> It focuses on how KaTeX-rendered HTML is turned into an interactive surface
> with reliable hover and click semantics, suitable for the Engine and TSA.

---

## 1. Goals and Responsibilities

The Viewer is responsible for:

1. **Rendering** mathematical expressions as HTML using KaTeX.
2. **Building an interactive map** of the rendered expression (Surface Node Map)
   based on the actual DOM and geometry in the browser.
3. **Providing precise hover and click semantics**:
   - hover always highlights exactly one meaningful atomic element
     (number, operator, parenthesis, fraction bar, etc.);
   - click identifies the same atomic element and provides all information
     required for the Engine.
4. **Supporting selection (rubber-band)** for TSA/debug and future features.
5. **Emitting normalized events** (Display → ClientEvent) that are independent
   of KaTeX internals and suitable for the Engine/FileBus.

The Viewer is **not** responsible for:

- deciding which mathematical step to apply;
- checking invariants or choosing primitives;
- modifying the underlying formula.

Those concerns belong to the Engine and TSA.

---

## 2. High-Level Architecture

The Viewer pipeline consists of the following layers:

1. **KaTeX Rendering**
   - Input: LaTeX string.
   - Output: HTML DOM subtree inside a dedicated container element.

2. **Surface Node Map (SNM)**
   - Input: KaTeX DOM subtree.
   - Output:
     - a tree of `SurfaceNode` structures;
     - a flat list of **atomic nodes**;
     - a `byElement` map for hit-testing.

3. **Display / UI**
   - Listens to pointer events on the container (`pointermove`, `pointerdown`,
     `pointerup`, etc.).
   - Maps events to `SurfaceNode` using `SurfaceNodeMap.byElement` and node
     bounding boxes.
   - Maintains transient UI state:
     - current hover node,
     - current selection rectangle,
     - selected nodes.

4. **Display Adapter**
   - Converts Display-level events into normalized **ClientEvents** for FileBus
     and the Engine.
   - Encodes:
     - event type (`hover`, `click`, `selectionChanged`, …);
     - `surfaceNodeId`, `surfaceNodeKind`, `surfaceNodeRole`,
       `surfaceOperatorIndex`;
     - pointer/selection metadata.

The **single source of truth for geometry** is the **live HTML DOM** produced by
KaTeX. All coordinates and hit-tests are based on DOM and
`getBoundingClientRect()`, **never** on LaTeX or AST alone.

---

## 3. Surface Node Map

### 3.1. Definitions

A **SurfaceNode** represents a meaningful visual unit of the math expression
as it appears in the browser.

Each `SurfaceNode` has at least:

- `id: string` – globally unique within the rendered expression;
- `kind: SurfaceNodeKind`;
- `role: SurfaceNodeRole` (optional but recommended);
- `bbox: Rect` – bounding box in **container-relative coordinates**;
- `latexFragment?: string` – textual representation for debugging.

#### 3.1.1. SurfaceNodeKind (examples)

The exact enum is defined in code, but the Viewer **must** support at least:

- `Num` – integer number (e.g. `2`, `123`);
- `Decimal` – decimal number (e.g. `2.5`);
- `Var` – variable (e.g. `x`, `y`, Greek letters);
- `BinaryOp` – binary operator (`+`, `−`, `*`, `⋅`, `×`, `/`, `:` etc.);
- `Relation` – relational operator (`=`, `<`, `>`, `≤`, `≥`);
- `ParenOpen`, `ParenClose` – parentheses;
- `FracBar` – visual fraction bar;
- `Fraction` – whole fraction as a composite node;
- `MixedNumber` – composite node for mixed numbers (e.g. `2 3/4`);
- `MinusUnary`, `MinusBinary` – unary vs binary minus (postprocessing);
- `Other` – internal placeholder, not exposed as an atom.

#### 3.1.2. SurfaceNodeRole (examples)

Roles clarify the function of a node within a larger structure:

- `operand` – number/variable operand of an operator;
- `operator` – operator symbol;
- `numerator`, `denominator` – positions within a fraction;
- `wholePart`, `fractionPart` – positions within a mixed number;
- `structural` – non-atomic helper (not selectable).

### 3.2. SurfaceNodeMap Structure

```ts
interface SurfaceNodeMap {
  root: SurfaceNode;                  // root of the expression
  atoms: SurfaceNode[];               // atomic nodes for hover/click
  byElement: Map<HTMLElement, SurfaceNode>;
}
atoms contains only atomic nodes:

Num, Decimal, Var,

BinaryOp, Relation,

ParenOpen, ParenClose,

FracBar,

MixedNumber (as a visual unit), etc.

byElement maps from DOM elements to the corresponding SurfaceNode. This
is the primary structure used for hit-testing via event.target.

3.3. Geometry and Coordinate System
For every atomic node, Viewer uses element.getBoundingClientRect() to
obtain the bounding box.

The bbox is normalized to coordinates relative to the main Viewer
container (top-left of the container is (0, 0)).

The container’s scroll/offset/zoom are taken into account when converting
client coordinates to container coordinates.

4. Node Construction Rules and Invariants
4.1. HTML as Source of Truth
Viewer never tries to reconstruct geometry from LaTeX or AST.

SNM is built strictly from the KaTeX HTML DOM:

by traversing elements,

by inspecting classes (katex-*, mbin, mrel, etc.),

by reading text content.

4.2. Atomic Numbers (Num / Decimal)
Invariant N1 – Pure numeric content

Nodes with kind = "Num" or kind = "Decimal" represent only numeric
tokens:

digits 0–9,

an optional decimal dot for Decimal.

Their latexFragment must not contain binary operator characters:

text
Copy code
+  -  −  *  /  :  ⋅  ·  ×
Examples:

"2" → Num;

"2.5" → Decimal;

"123" → Num.

Forbidden:

"2+", "3−", "5-1" must never become a single Num or Decimal
atom.

4.3. Atomic Operators (BinaryOp / Relation / Minus*)
Invariant O1 – Separate operator nodes

Every visible operator (+, −, *, ⋅, ×, /, :, =, <, >, ≤,
≥) must be represented by a dedicated atomic node:

kind: "BinaryOp" or kind: "Relation",

role: "operator" where applicable.

Operators must not be glued to adjacent numbers inside a single Num
or Decimal node.

Invariant O2 – Operator indices

Binary operators and relations that participate in a sequence (e.g. 2 + 3 − 1)
receive a surfaceOperatorIndex: number, assigned in left-to-right order.

The index must be stable for the given rendering and used by the Engine to
identify which operator the user clicked.

4.4. Mixed Numeric + Operator Containers
KaTeX may sometimes group characters like "2+" or "3−" inside a single
span. The SNM builder must not treat such elements as atomic nodes.

Instead:

If an element’s text content contains both digits and operator characters,
it is treated as a structural container:

the element itself is not added to atoms,

its children are recursively traversed and classified.

This prevents accidental creation of hybrid atoms such as Num "2+".

4.5. Parentheses, Fractions, and Mixed Numbers
Parentheses:

( → ParenOpen, ) → ParenClose;

each parenthesis is a separate atomic node with its own bbox.

Fractions:

FracBar is an atomic node representing the visual fraction bar;

Fraction is a composite node that links to numerator and denominator;

numerator/denominator may have their own atoms.

Mixed numbers:

MixedNumber is a composite node representing constructs like 2 3/4;

may expose atomic children (Num for whole part, Fraction for fraction
part), depending on UI needs.

4.6. Unary vs Binary Minus
A post-processing step distinguishes MinusUnary and MinusBinary based on
context (start of expression, after operator, etc.).

For hover/click purposes, unary and binary minus are still atomic nodes with
well-defined bbox and surfaceOperatorIndex where applicable.

5. Hover Semantics
5.1. Event Source
Viewer listens to pointermove events on the main container.

5.2. Mapping Pointer to SurfaceNode
The hover algorithm is:

Receive PointerEvent e.

Let target = e.target as HTMLElement.

Find the nearest ancestor that is present in SurfaceNodeMap.byElement:

ts
Copy code
function findNodeByElement(target: HTMLElement | null): SurfaceNode | null {
  let el = target;
  while (el && el !== container && !map.byElement.has(el)) {
    el = el.parentElement;
  }
  return el ? map.byElement.get(el) ?? null : null;
}
The result of findNodeByElement is the hover node.

5.3. Hover Invariants
H1 – Exactly one atomic node

At any time, hover highlights at most one atomic node.

The highlight rectangle is exactly that node’s bbox.

H2 – No hybrid nodes

Because of the construction rules (Section 4), a hover highlight must
never correspond to a node whose latexFragment mixes numbers and operators
(e.g. "2+", "3−").

Valid examples:

Num "2";

BinaryOp "+";

FracBar (the fraction bar);

Var "x", etc.

H3 – Stable behavior across gaps

When the pointer is in a visual gap between symbols, Viewer may:

either keep the highlight on the closest atomic node,

or clear hover (no highlight),

but must not spontaneously highlight a “virtual combination” of multiple
atoms.

5.4. Hover Event Payload (Display → Engine)
For each hover update, Viewer emits a Display/ClientEvent with at least:

ts
Copy code
interface HoverEvent {
  type: "hover";
  surfaceNodeId: string | null;
  surfaceNodeKind?: SurfaceNodeKind;
  surfaceNodeRole?: SurfaceNodeRole;
  surfaceOperatorIndex?: number | null;
  pointer: {
    clientX: number;
    clientY: number;
  };
}
If no node is hovered, surfaceNodeId is null.

6. Click Semantics
6.1. Gesture Recognition
Viewer listens to pointerdown and pointerup on the container.

A click is defined as:

primary button,

pointerup on the same button,

total pointer movement below a small threshold (no drag).

6.2. Mapping Click to SurfaceNode
On pointerup that qualifies as a click:

Use the same findNodeByElement(e.target) function as for hover.

The resulting node is the click target.

Invariant C1 – Consistency with hover

If the pointer is on a given atomic node:

hover and click must identify the same SurfaceNode.

A user must never see one element highlighted while the click event refers
to a different one.

6.3. Click Event Payload
The Display Adapter constructs a ClientEvent for clicks:

ts
Copy code
interface ClickEvent {
  type: "click";
  timestamp: number;
  latex: string; // full LaTeX of the expression

  surfaceNodeId: string | null;
  surfaceNodeKind?: SurfaceNodeKind;
  surfaceNodeRole?: SurfaceNodeRole;
  surfaceOperatorIndex?: number | null;

  click: {
    button: "left" | "right";
    clickCount: 1 | 2;
    modifiers: {
      shift: boolean;
      alt: boolean;
      ctrl: boolean;
      meta: boolean;
    };
  };

  pointer: {
    clientX: number;
    clientY: number;
  };

  selection?: SelectionSnapshot; // optional, see Section 7
}
The Engine and TSA use surfaceNodeKind, surfaceNodeRole,
surfaceOperatorIndex, and the context of the expression to build the
NodeContext and match primitives.

7. Selection (Rubber-Band)
7.1. Gesture
Start: pointerdown with primary button on the container.

Update: pointermove with button pressed; Viewer displays a translucent
rectangle between the start point and current pointer position.

End: pointerup:

if movement exceeds the click threshold → treated as a selection;

otherwise falls back to click semantics (Section 6).

7.2. Hit-Testing Selection Rectangle
Given a selection rectangle R in container coordinates, Viewer determines
a set of selected nodes:

For each atomic node with bounding box bbox:

Option A: contains – bbox must be fully inside R;

Option B: intersects – bbox must intersect R by at least a
minimal amount.

The chosen rule should be consistent and documented; Option A is preferable
for more predictable selections.

7.3. Selection Event Payload
On selection change, Viewer emits:

ts
Copy code
interface SelectionChangedEvent {
  type: "selectionChanged";
  timestamp: number;
  selection: SelectionSnapshot;
}

interface SelectionSnapshot {
  rect: Rect | null;          // selection rectangle in container coords
  nodeIds: string[];          // ids of selected atomic nodes
}
8. Display Adapter Contract
The Display Adapter is the bridge between UI events and Engine/FileBus.

8.1. Event Types
Supported event types:

"hover" – see Section 5;

"click" – see Section 6;

"dblclick" – optional future extension;

"context" – right-click context menu (optional);

"selectionChanged" – see Section 7.

All events share a common base:

ts
Copy code
interface DisplayEventBase {
  type: "hover" | "click" | "dblclick" | "context" | "selectionChanged";
  timestamp: number;
  surfaceNodeId?: string | null;
  surfaceNodeKind?: SurfaceNodeKind;
  surfaceNodeRole?: SurfaceNodeRole;
  surfaceOperatorIndex?: number | null;
}
8.2. Requirements
Lossless mapping:
If a SurfaceNode can be hovered or clicked, its id, kind, role,
and surfaceOperatorIndex must be present in the Display event.

Stability:
As long as the rendered expression and the DOM do not change, repeated
hover/click on the same visual element must produce the same
surfaceNodeId and surfaceOperatorIndex.

Engine-friendly:
Display events must provide enough information so that NodeContext can
reconstruct:

what the user clicked (operator vs operand),

which operator in a chain (surfaceOperatorIndex),

surrounding window for TSA (via other Engine mechanisms).

9. Informal Acceptance Example: 2 + 3 − 1
For the expression:

latex
Copy code
2 + 3 - 1
and the corresponding KaTeX rendering, a correct Viewer implementation must
satisfy:

SurfaceNodeMap:

Atomic nodes:

Num "2", BinaryOp "+", Num "3", MinusBinary "−", Num "1".

No atomic node with latexFragment "2+" or "3−".

Hover:

Moving the pointer slowly from left to right yields:

highlight Num "2",

then BinaryOp "+",

then Num "3",

then MinusBinary "−",

then Num "1".

When pointer is between symbols, Viewer may either:

clear hover, or

keep the last valid hovered node,

but must never highlight a virtual combined region ("2+", "3−").

Click:

Click on the rendered + symbol:

surfaceNodeKind = "BinaryOp",

surfaceNodeRole = "operator",

a valid surfaceOperatorIndex (e.g. 0).

Click on the 3:

surfaceNodeKind = "Num",

surfaceNodeRole = "operand".

These conditions must hold independently of any internal KaTeX changes, as long
as the final DOM still visually represents 2 + 3 − 1.

10. Future Work
Support for more complex structures (roots, matrices, piecewise functions)
using the same principles.

Configurable hover behavior:

e.g. parenthesized groups or entire fractions acting as a single hover
target in certain modes.

Extended analytics events for TSA (e.g. activity logging, error patterns),
built on top of the same DisplayEvent contract.

