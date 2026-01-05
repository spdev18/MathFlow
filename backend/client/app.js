const API_URL = "http://localhost:4202/api/entry-step";
const SESSION_ID = "demo-session-" + Date.now();
const INITIAL_EXPRESSION = "3 + 2/5";

const container = document.getElementById("math-container");
const logDiv = document.getElementById("log");
const stepBtn = document.getElementById("step-btn");
const resetBtn = document.getElementById("reset-btn");

let currentLatex = INITIAL_EXPRESSION;

function appendToLog(text) {
  logDiv.textContent += text + "\n";
  logDiv.scrollTop = logDiv.scrollHeight;
  console.log(text);
}

function log(label, obj) {
  if (obj !== undefined) {
    appendToLog(label + " " + JSON.stringify(obj, null, 2));
  } else {
    appendToLog(label);
  }
}

function renderMath(latex) {
  currentLatex = latex;

  try {
    if (window.katex) {
      window.katex.render(latex, container, {
        throwOnError: false,
        strict: "ignore",
      });
    } else {
      container.textContent = latex;
      log("KaTeX not loaded; showing plain text.");
    }
  } catch (err) {
    container.textContent = latex;
    log("KaTeX render error: " + err.message);
  }
}

async function sendStep() {
  const payload = {
    sessionId: SESSION_ID,
    courseId: "default",
    expressionLatex: currentLatex,
    selectionPath: null,
    policyId: "student.basic",
  };

  log("Request:", payload);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    log("Response:", data);

    if (
      data.status === "step-applied" ||
      data.status === "no-candidates"
    ) {
      if (typeof data.expressionLatex === "string") {
        renderMath(data.expressionLatex);
      }
    } else if (data.status === "engine-error") {
      log("Engine error from backend.");
    } else {
      log("Unexpected status from backend: " + data.status);
    }
  } catch (err) {
    log("Network error: " + err.message);
  }
}

// Click handlers
stepBtn.addEventListener("click", () => {
  sendStep();
});

resetBtn.addEventListener("click", () => {
  renderMath(INITIAL_EXPRESSION);
  log("Reset.");
});

// Initial render
renderMath(INITIAL_EXPRESSION);
log("Demo client initialized with expression: " + INITIAL_EXPRESSION);
