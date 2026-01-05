// MapMaster Introspect Dev Page (Variant B · B7 HTTP)

const HTTP_URL = "http://localhost:4201/mapmaster-introspect";

const SAMPLE_REQUEST = {
  mode: "preview",
  expression: {
    id: "ex-001",
    latex: "\\frac{1}{3} + \\frac{2}{5}",
    displayVersion: "itu-e2e-mapmaster-introspect",
    invariantSetId: "fractions-basic.v1"
  },
  clientEvent: {
    type: "click",
    timestamp: 0,
    latex: "\\frac{1}{3} + \\frac{2}{5}",
    surfaceNodeId: "surf-whole-expression",
    selection: ["surf-frac-1", "surf-plus", "surf-frac-2"],
    click: {
      button: "left",
      clickCount: 1,
      modifiers: { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false }
    }
  },
  tsaSelection: {
    selectionMapVersion: "sm-v1",
    primaryRegionId: "tsa-sum-of-two-fractions",
    allRegionIds: ["tsa-frac-1", "tsa-plus", "tsa-frac-2"],
    flags: { isWholeFraction: false }
  },
  policy: {
    stepLevel: "student",
    allowMultipleSteps: false,
    maxCandidates: 3
  },
  engineView: {
    stage1: "1/3 + 2/5",
    root: {
      kind: "binaryOp",
      op: "add",
      indexInStage1: 0,
      left: { kind: "rational", numerator: "1", denominator: "3" },
      right: { kind: "rational", numerator: "2", denominator: "5" }
    }
  }
};

const LOCAL_SUMMARY = {
  expressionId: "ex-001",
  latex: "\\frac{1}{3} + \\frac{2}{5}",
  invariantSetId: "fractions-basic.v1",
  engineStage1: "1/3 + 2/5",
  candidateCount: 1,
  chosenCandidate: {
    id: "step-add-fractions-diff-den-1",
    kind: "add-fractions",
    invariantId: "frac.add.diff-den.v1",
    engineOperation: "ADD_FRACTIONS_DIFF_DEN",
    engineOperands: ["root/left", "root/right"]
  },
  messages: [
    {
      level: "info",
      code: "INVARIANT_MATCH_ADD_DIFF_DEN",
      text: "Matched invariant frac.add.diff-den.v1 for sum of two fractions with different denominators."
    }
  ]
};

const TOKEN_DEFS = [
  { id: "surf-frac-1", label: "1/3" },
  { id: "surf-plus", label: "+" },
  { id: "surf-frac-2", label: "2/5" }
];

const LOCAL_CANDIDATE_SURFACE_REGION_IDS = ["surf-frac-1", "surf-plus", "surf-frac-2"];

let currentSummary = LOCAL_SUMMARY;
let currentSelection = new Set();

function renderFormula() {
  const target = document.getElementById("formula-latex");
  if (!target) return;
  const latex = currentSummary.latex || LOCAL_SUMMARY.latex;

  if (typeof katex === "undefined") {
    target.textContent = latex;
    return;
  }
  try {
    katex.render(latex, target, { throwOnError: false, displayMode: true });
  } catch (err) {
    console.error("Error rendering KaTeX formula:", err);
    target.textContent = latex;
  }
}

function renderMeta() {
  const metaContainer = document.getElementById("meta-container");
  const pillRow = document.getElementById("pill-row");
  if (!metaContainer || !pillRow) return;

  metaContainer.innerHTML = "";
  const metaItems = [
    { label: "Expression ID", value: currentSummary.expressionId },
    { label: "Invariant Set", value: currentSummary.invariantSetId },
    { label: "Stage1 View", value: currentSummary.engineStage1 },
    { label: "Candidates", value: String(currentSummary.candidateCount) }
  ];

  for (const item of metaItems) {
    const div = document.createElement("div");
    div.className = "meta-item";
    const label = document.createElement("div");
    label.className = "meta-label";
    label.textContent = item.label;
    const value = document.createElement("div");
    value.className = "meta-value";
    value.textContent = item.value;
    div.appendChild(label);
    div.appendChild(value);
    metaContainer.appendChild(div);
  }

  pillRow.innerHTML = "";
  if (currentSummary.chosenCandidate) {
    const { id, invariantId, engineOperation } = currentSummary.chosenCandidate;

    const pillCandidate = document.createElement("div");
    pillCandidate.className = "pill";
    pillCandidate.innerHTML = "<span class=\"key\">Chosen</span><span>" + id + "</span>";
    pillRow.appendChild(pillCandidate);

    const pillInvariant = document.createElement("div");
    pillInvariant.className = "pill";
    pillInvariant.innerHTML = "<span class=\"key\">Invariant</span><span>" + invariantId + "</span>";
    pillRow.appendChild(pillInvariant);

    const pillOp = document.createElement("div");
    pillOp.className = "pill";
    pillOp.innerHTML = "<span class=\"key\">Operation</span><span>" + engineOperation + "</span>";
    pillRow.appendChild(pillOp);
  }
}


function renderStepMaster() {
  const container = document.getElementById("stepmaster-steps");
  if (!container) return;

  const sm = currentSummary && currentSummary.stepMaster;
  if (!sm || !Array.isArray(sm.microSteps) || sm.microSteps.length === 0) {
    container.innerHTML =
      '<div class="hint">No StepMaster micro-steps yet. Call HTTP introspect.</div>';
    return;
  }

  const parts = [];
  parts.push(
    '<div class="meta">Scenario: <strong>' +
      sm.scenarioId +
      '</strong> · Invariant: <code>' +
      sm.invariantId +
      '</code></div>'
  );
  parts.push('<ol class="stepmaster-list">');
  for (let i = 0; i < sm.microSteps.length; i++) {
    const step = sm.microSteps[i];
    const desc =
      step.description && step.description.shortStudent
        ? step.description.shortStudent
        : '';
    parts.push('<li class="stepmaster-item">');
    parts.push(
      '<div class="step-kind-pill">' +
        (step.kind || 'step') +
      '</div>'
    );
    parts.push(
      '<div class="step-latex"><code>' +
        step.fromLatex +
        '</code> → <code>' +
        step.toLatex +
        '</code></div>'
    );
    if (desc) {
      parts.push('<div class="step-desc">' + desc + '</div>');
    }
    parts.push('</li>');
  }
  parts.push('</ol>');

  container.innerHTML = parts.join('');
}

function renderTokens() {
  const strip = document.getElementById("token-strip");
  if (!strip) return;
  strip.innerHTML = "";
  for (const token of TOKEN_DEFS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "token";
    btn.dataset.regionId = token.id;

    const textSpan = document.createElement("span");
    textSpan.textContent = token.label;

    const codeSpan = document.createElement("span");
    codeSpan.className = "token-code";
    codeSpan.textContent = token.id;

    btn.appendChild(textSpan);
    btn.appendChild(codeSpan);

    btn.addEventListener("click", () => toggleToken(token.id));
    strip.appendChild(btn);
  }
  updateTokenStyles();
  updateSelectionLabel();
}

function toggleToken(regionId) {
  if (currentSelection.has(regionId)) currentSelection.delete(regionId);
  else currentSelection.add(regionId);
  updateTokenStyles();
  updateSelectionLabel();
}

function setSelection(regionIds) {
  currentSelection = new Set(regionIds);
  updateTokenStyles();
  updateSelectionLabel();
}

function clearSelection() {
  currentSelection = new Set();
  updateTokenStyles();
  updateSelectionLabel();
}

function updateTokenStyles() {
  const strip = document.getElementById("token-strip");
  if (!strip) return;
  const buttons = strip.querySelectorAll(".token");
  buttons.forEach((btn) => {
    const regionId = btn.dataset.regionId;
    if (regionId && currentSelection.has(regionId)) btn.classList.add("selected");
    else btn.classList.remove("selected");
  });
}

function updateSelectionLabel() {
  const labelEl = document.getElementById("selection-label");
  if (!labelEl) return;
  const ids = Array.from(currentSelection);
  labelEl.textContent =
    ids.length === 0
      ? "Current selection: (none)"
      : "Current selection: " + ids.join(", ");
}

function renderJsonBlocks(initial) {
  const reqEl = document.getElementById("json-request");
  const sumEl = document.getElementById("json-summary");
  if (!reqEl || !sumEl) return;

  const fingerprint = {
    mode: SAMPLE_REQUEST.mode,
    expression: SAMPLE_REQUEST.expression,
    policy: SAMPLE_REQUEST.policy,
    engineView: SAMPLE_REQUEST.engineView,
    tsaSelection: SAMPLE_REQUEST.tsaSelection
  };
  reqEl.textContent = JSON.stringify(fingerprint, null, 2);

  if (initial) {
    sumEl.textContent = JSON.stringify(
      { source: "local-demo", summary: LOCAL_SUMMARY },
      null,
      2
    );
  }
}

function setupControls() {
  const btnHighlight = document.getElementById("btn-highlight");
  const btnClear = document.getElementById("btn-clear");
  const btnHttp = document.getElementById("btn-http");

  if (btnHighlight) {
    btnHighlight.addEventListener("click", () => {
      setSelection(LOCAL_CANDIDATE_SURFACE_REGION_IDS);
    });
  }
  if (btnClear) {
    btnClear.addEventListener("click", () => {
      clearSelection();
    });
  }
  if (btnHttp) {
    btnHttp.addEventListener("click", () => {
      callHttpIntrospect();
    });
  }
}

async function callHttpIntrospect() {
  const sumEl = document.getElementById("json-summary");
  const labelEl = document.getElementById("selection-label");

  if (sumEl) {
    sumEl.textContent =
      "Calling " + HTTP_URL + " ...\n\n" +
      "Make sure the introspect server is running:\n" +
      "  cd D:\\07\\viewer\\display-engine-pipeline\n" +
      "  pnpm tsx ./src/dev/mapmaster-introspect-http-server.ts";
  }

  try {
    const resp = await fetch(HTTP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(SAMPLE_REQUEST)
    });

    if (!resp.ok) {
      throw new Error("HTTP " + resp.status + " " + resp.statusText);
    }

    const data = await resp.json();
    if (!data || !data.summary) {
      throw new Error("No summary field in HTTP response");
    }

    currentSummary = data.summary;
    renderMeta();
    renderStepMaster();

    if (sumEl) {
      sumEl.textContent = JSON.stringify(data, null, 2);
    }

    setSelection(LOCAL_CANDIDATE_SURFACE_REGION_IDS);
    if (labelEl) {
      labelEl.textContent =
        "Current selection (HTTP): " + Array.from(currentSelection).join(", ");
    }
  } catch (err) {
    console.error("HTTP introspect failed", err);
    if (sumEl) sumEl.textContent = "HTTP error: " + String(err);
    if (labelEl) labelEl.textContent = "Current selection: (HTTP error)";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderFormula();
  renderMeta();
  renderTokens();
  renderJsonBlocks(true);
  renderStepMaster();
  setupControls();
});
