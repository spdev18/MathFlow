# Surface Node Map — техническое описание

## 1. Цель

Нужен отдельный модуль, который по уже отрендеренному KaTeX‑HTML строит
**карту интерактивности** (Surface Node Map, SNM):

* фиксирует *семантические* элементы формулы (числа, знаки, скобки, дроби и т.п.);
* для каждого такого элемента знает:
  * что это за элемент (тип/роль),
  * где он находится на экране (геометрия),
  * как он вложен в другие элементы (дерево);
* позволяет по координатам курсора (x, y) однозначно определить,
  какой *атомарный* элемент формулы был под мышкой.

KaTeX/LaTeX в этой схеме — генератор HTML.
Источник истины для интерактивности: **DOM + CSS → getBoundingClientRect → SurfaceNodeMap**.


## 2. Контекст: где живет модуль

В нашей аппликации есть связка:

* **Display Viewer** — окно, где формула показывается через KaTeX.
* **Display Adapter** — слой, который:
  * превращает pointer‑события браузера в абстрактные жесты (tap, drag, …),
  * логирует client_event для Engine.

Surface Node Map (SNM) — это отдельный модуль, который живет
между *KaTeX‑DOM* и *Display Adapter*:

1. KaTeX отрисовал формулу в контейнер Viewer.
2. SNM пробегает по DOM, строит SurfaceNodeMap.
3. Display Adapter при каждом hover/клике:
   * вызывает hit‑test по карте,
   * получает SurfaceNode (id/kind/role/bbox),
   * упаковывает в жест и шлет в Engine.


## 3. Модель данных

```ts
type NodeKind =
  | "Root"
  | "Num"
  | "Var"
  | "BinaryOp"
  | "Relation"
  | "ParenOpen"
  | "ParenClose"
  | "FracBar"
  | "Fraction"
  | "Group"
  | "Other";

type NodeRole =
  | "root"
  | "operand"
  | "operator"
  | "decorator"
  | "numerator"
  | "denominator"
  | "group";

interface BoundingBox {
  left: number;   // координаты относительно контейнера Viewer
  top: number;
  right: number;
  bottom: number;
}

interface SurfaceNode {
  id: string;
  kind: NodeKind;
  role: NodeRole;
  bbox: BoundingBox;
  dom: Element;           // живой DOM-элемент (для подсветки/дебага)
  latexFragment: string;  // текстовый фрагмент, если есть
  children: SurfaceNode[];
  parent: SurfaceNode | null;
}

interface SurfaceNodeMap {
  root: SurfaceNode;                // корень дерева (сам контейнер)
  atoms: SurfaceNode[];             // плоский список атомарных узлов
  byElement: Map<Element, SurfaceNode>;
}
```

**Атомарные узлы** — это то, что мы хотим ловить мышкой напрямую:

* `Num` — числа;
* `Var` — отдельные переменные;
* `BinaryOp` / `Relation` — операторы и отношения (`+`, `-`, `⋅`, `=`, …);
* `ParenOpen` / `ParenClose` — скобки;
* `FracBar` — дробная черта.

`Fraction` и `Group` — агрегаты, обычно не считаются атомами.


## 4. Алгоритм построения карты

### 4.1. Входные данные

* `containerElement: HTMLElement` — DOM‑контейнер Display Viewer,
  внутри которого KaTeX уже отрисовал формулу.
* Предполагаем стандартную структуру:
  `containerElement` содержит `.katex-html > .base` как корень визуального дерева.


### 4.2. Шаг 1. Фиксация системы координат

Берем bounding box контейнера:

```ts
const containerBox = containerElement.getBoundingClientRect();
```

Все последующие bbox узлов переводим в **относительные координаты**:

```ts
function toRelativeBox(el: Element, containerBox: DOMRect): BoundingBox {
  const r = el.getBoundingClientRect();
  return {
    left: r.left - containerBox.left,
    top: r.top - containerBox.top,
    right: r.right - containerBox.left,
    bottom: r.bottom - containerBox.top,
  };
}
```

Это дает единую систему координат для hit‑test и визуальной подсветки.


### 4.3. Шаг 2. Классификация DOM-элементов

По каждому `Element` смотрим:

* `classList` KaTeX;
* `textContent` (обрезанное по краям).

Правила:

* **Структурные обертки** (верстка, не математика):
  * `.vlist`, `.vlist-t`, `.vlist-r`, `.vbox`,
  * `.pstrut`, `.sizing`, `.fontsize-ensurer`, `.mspace`, …
  → считаются *прозрачными*: мы не создаем для них SurfaceNode, а
  просто рекурсивно обходим их детей.

* **Числа**:
  * класс содержит `mord`, текст = только цифры → `kind: "Num", role: "operand"`.

* **Переменные**:
  * класс содержит `mord`, текст = одна латинская буква → `kind: "Var"`.

* **Знаки**:
  * текст = один символ из `[+\-*/:]` → `kind: "BinaryOp", role: "operator"`,
    даже если KaTeX не пометил его как `mbin`;
  * класс `mbin` → бинарный оператор;
  * класс `mrel` → отношение (`=`, `<`, `>` и т.п.).

* **Скобки**:
  * `mopen` → `ParenOpen`,
  * `mclose` → `ParenClose`.

* **Дробная черта**:
  * класс содержит `frac-line` → `kind: "FracBar", role: "decorator"`.

* **Контейнер дроби**:
  * класс содержит `mfrac` → `kind: "Fraction", role: "operator"`.

* Остальное → `kind: "Other", role: "group"`.

Дополнительно: если элемент классифицирован как `Other` и при этом:

* не имеет текста,
* или имеет нулевой/почти нулевой размер,

то он считается *прозрачной* группой — не создает отдельный SurfaceNode, но его дети будут обработаны.


### 4.4. Шаг 3. Обход DOM и построение дерева

Алгоритм:

```ts
const atoms: SurfaceNode[] = [];
const byElement = new Map<Element, SurfaceNode>();
let idCounter = 0;
const nextId = (prefix: string) => `${prefix}-${(++idCounter).toString(36)}`;

const rootNode: SurfaceNode = {
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

function traverse(element: Element, parent: SurfaceNode) {
  const classes = Array.from(element.classList || []);
  const text = (element.textContent || "").trim();

  if (isStructural(classes)) {
    // прозрачная обертка
    Array.from(element.children || []).forEach((child) =>
      traverse(child, parent)
    );
    return;
  }

  const info = classifyElement(element, classes, text);
  const bbox = toRelativeBox(element, containerBox);
  const width = bbox.right - bbox.left;
  const height = bbox.bottom - bbox.top;
  const hasSize = width > 0.5 && height > 0.5;

  if (info.kind === "Other" && (!text || !hasSize)) {
    // прозрачная группа
    Array.from(element.children || []).forEach((child) =>
      traverse(child, parent)
    );
    return;
  }

  const node: SurfaceNode = {
    id: nextId(info.idPrefix),
    kind: info.kind,
    role: info.role,
    bbox,
    dom: element,
    latexFragment: text,
    children: [],
    parent,
  };

  parent.children.push(node);
  byElement.set(element, node);

  if (info.atomic || isAtomicKind(node.kind)) {
    atoms.push(node);
  }

  Array.from(element.children || []).forEach((child) =>
    traverse(child, node)
  );
}
```

Старт:

```ts
const base = containerElement.querySelector(".katex-html .base");
if (base) traverse(base, rootNode);

const map: SurfaceNodeMap = { root: rootNode, atoms, byElement };
```


## 5. Hit-test по карте

Hit‑test работает только по **атомарным** узлам:

```ts
function hitTestPoint(
  map: SurfaceNodeMap,
  clientX: number,
  clientY: number,
  containerElement: HTMLElement
): SurfaceNode | null {
  const cbox = containerElement.getBoundingClientRect();
  const x = clientX - cbox.left;
  const y = clientY - cbox.top;

  const candidates = map.atoms.filter((node) => {
    const b = node.bbox;
    return x >= b.left && x <= b.right && y >= b.top && y <= b.bottom;
  });

  if (candidates.length === 0) return null;

  // Выбираем самый "мелкий" по площади — приблизительно самый глубокий
  candidates.sort((a, b) => {
    const areaA =
      (a.bbox.right - a.bbox.left) * (a.bbox.bottom - a.bbox.top);
    const areaB =
      (b.bbox.right - b.bbox.left) * (b.bbox.bottom - b.bbox.top);
    return areaA - areaB;
  });

  return candidates[0];
}
```

Дальше Display Adapter может:

* на `pointermove` вызывать `hitTestPoint` и подсвечивать `hoverNode`,
* на `pointerup` — вызывать `hitTestPoint` и формировать жест `tap` по `node.id`.


## 6. Сериализация карты в JSON

Для логирования и отладки нужен JSON-дружелюбный вид:

```ts
interface PlainSurfaceNode {
  id: string;
  kind: NodeKind;
  role: NodeRole;
  bbox: BoundingBox;
  latexFragment: string;
  children: PlainSurfaceNode[];
}

interface SerializableSurfaceMap {
  root: PlainSurfaceNode;
}
```

Функция:

```ts
function surfaceMapToSerializable(map: SurfaceNodeMap): SerializableSurfaceMap {
  function toPlain(node: SurfaceNode): PlainSurfaceNode {
    return {
      id: node.id,
      kind: node.kind,
      role: node.role,
      bbox: node.bbox,
      latexFragment: node.latexFragment,
      children: node.children.map(toPlain),
    };
  }
  return { root: toPlain(map.root) };
}
```

Этот JSON можно:

* показывать справа в Event Log,
* сохранять в файл (Download JSON),
* отдавать в Recorder/Player.


## 7. Как это вписывается в аппликацию

1. **Display Viewer (KaTeX)**
   * Рисует формулу в контейнер `viewerRef`.
   * После успешного рендера вызывает `buildSurfaceNodeMap(viewerRef)`.

2. **Surface-map модуль**
   * Строит `SurfaceNodeMap`.
   * Предоставляет:
     * `buildSurfaceNodeMap(container)`,
     * `surfaceMapToSerializable(map)`,
     * `hitTestPoint(map, x, y, container)`.

3. **Display Adapter**
   * Заменяет свою текущую внутреннюю модель `SurfaceNode` на `SurfaceNodeMap`.
   * Все pointer‑события (hover, tap, drag) начинают работать через hit‑test по карте.

4. **Engine / FileBus**
   * Дальше ничего не меняется: клиентские события получают `nodeId` и `role`,
     но теперь эти id полностью основаны на геометрически корректной карте.


## 8. Что реализовано в этом ZIP

В данном пакете:

* `katex/` — локальная сборка KaTeX (JS + CSS + шрифты).
* `index.html` — простая страница:
  * слева — Display Viewer с KaTeX,
  * справа — JSON‑панель.
* `app/surface-map.js` — модуль с реализацией:
  * `buildSurfaceNodeMap`,
  * `surfaceMapToSerializable`,
  * `hitTestPoint`.
* `app/main.js` — минимальное демо:
  * рендерит каноническую формулу
    `\frac{(2+3)\cdot(4-1)}{\frac{5}{6}+\frac{7}{8}}+9\cdot5-\frac{5}{8}`,
  * строит карту,
  * показывает JSON‑дамп в правой панели,
  * позволяет пересобрать карту кнопкой **Rebuild map**,
  * позволяет сохранить JSON кнопкой **Download JSON**.

Этот модуль можно интегрировать в основную аппликацию, перенесла
интерфейсы `buildSurfaceNodeMap`, `surfaceMapToSerializable` и `hitTestPoint`
в пакет Display Adapter и подключив их из React‑компонента Display Viewer.
