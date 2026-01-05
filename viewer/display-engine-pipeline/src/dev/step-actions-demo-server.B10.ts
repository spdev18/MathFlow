/**
 * StepMaster Action Layer – Viewer demo server (B10, apply steps, v7).
 *
 * Demo-only server for fractions-basic.v1 / frac.add.diff-den.v1
 * to exercise StepMaster one-step actions and applying them.
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { computeDemoActionsForFractions } from "../../../../mapmaster-bridge/src/stepmaster/stepmaster.actions.fractions-basic.demo";
import type {
  StepActionQuery,
  StepActionResponse,
} from "../../../../mapmaster-bridge/src/stepmaster/stepmaster.actions.types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 4203;
const ROOT_PATH = "/step-actions-demo";
const ACTIONS_PATH = `${ROOT_PATH}/actions`;

const KATEX_CSS_PATH = "/katex/katex.min.css";
const KATEX_JS_PATH = "/katex/katex.min.js";

// __dirname here is .../viewer/display-engine-pipeline/src/dev
// We want .../viewer/katex
const KATEX_DIR = path.resolve(__dirname, "../../..", "katex");

const DEMO_LATEX = "\\frac{1}{3} + \\frac{2}{5}";
const DEMO_INVARIANT_SET_ID = "fractions-basic.v1";
const DEMO_INVARIANT_ID = "frac.add.diff-den.v1";

function sendHtml(res: http.ServerResponse): void {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");

  const html = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>StepMaster Actions Viewer Demo (B10 – apply)</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link
      rel="stylesheet"
      href="${KATEX_CSS_PATH}"
    />
    <style>
      body {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
          sans-serif;
        margin: 0;
        padding: 1.5rem;
        background: #f5f5f5;
      }
      .page {
        max-width: 960px;
        margin: 0 auto;
        background: #ffffff;
        border-radius: 12px;
        padding: 1.5rem;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
      }
      h1 {
        font-size: 1.4rem;
        margin-top: 0;
      }
      .expr-box {
        border: 1px solid #e0e0e0;
        border-radius: 10px;
        padding: 1rem;
        margin-bottom: 1rem;
        background: #fafafa;
        cursor: pointer;
      }
      .expr-box:hover {
        border-color: #1976d2;
        box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.12);
      }
      .expr-title {
        font-weight: 600;
        margin-bottom: 0.5rem;
      }
      .expr-body {
        min-height: 2.2rem;
        font-size: 1.6rem;
      }
      .controls {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 1rem;
      }
      .controls button {
        padding: 0.4rem 0.9rem;
        border-radius: 6px;
        border: 1px solid #1976d2;
        background: #1976d2;
        color: #ffffff;
        cursor: pointer;
        font-size: 0.9rem;
      }
      .controls button.secondary {
        background: #ffffff;
        color: #1976d2;
      }
      .controls button:hover {
        opacity: 0.9;
      }
      .section-title {
        font-weight: 600;
        margin: 1rem 0 0.5rem;
      }
      .actions {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      .actions li {
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 0.75rem;
        margin-bottom: 0.75rem;
        background: #fafafa;
      }
      .action-header {
        display: flex;
        gap: 0.5rem;
        align-items: baseline;
        margin-bottom: 0.25rem;
      }
      .action-kind {
        font-weight: 600;
        font-size: 0.85rem;
        padding: 0.1rem 0.4rem;
        border-radius: 4px;
        background: #e3f2fd;
        color: #1565c0;
      }
      .action-rule {
        font-size: 0.8rem;
        color: #757575;
      }
      .action-student {
        font-size: 0.9rem;
        margin-bottom: 0.25rem;
      }
      .action-teacher {
        font-size: 0.8rem;
        color: #616161;
        margin-bottom: 0.5rem;
      }
      .action-buttons {
        display: flex;
        gap: 0.5rem;
      }
      .action-buttons button {
        padding: 0.25rem 0.6rem;
        border-radius: 4px;
        border: 1px solid #388e3c;
        background: #388e3c;
        color: #ffffff;
        cursor: pointer;
        font-size: 0.8rem;
      }
      .action-buttons button:hover {
        opacity: 0.92;
      }
      .error {
        color: #c62828;
        margin-top: 0.5rem;
        font-size: 0.9rem;
      }
      .debug {
        margin-top: 1rem;
        padding: 0.75rem;
        border-radius: 8px;
        background: #212121;
        color: #eeeeee;
        font-family: "SFMono-Regular", ui-monospace, Menlo, Monaco, Consolas,
          "Liberation Mono", "Courier New", monospace;
        font-size: 0.8rem;
        max-height: 260px;
        overflow: auto;
      }
    </style>
  </head>
  <body>
    <div class="page">
      <h1>StepMaster Actions Viewer Demo (B10 – apply)</h1>
      <p>
        Demo pipeline:
        <strong>Display → StepMaster Action Layer → demo scenario</strong>.
        Click the expression to request <em>one-step</em> actions, then apply a
        step and watch how the expression changes.
      </p>

      <div class="expr-box" id="expr-box">
        <div class="expr-title">
          Current expression (click to load actions)
        </div>
        <div id="expr-container" class="expr-body"></div>
      </div>

      <div class="controls">
        <button id="reset-btn" type="button">Reset to initial</button>
        <button id="reload-btn" type="button" class="secondary">
          Reload actions
        </button>
      </div>

      <div class="section-title">
        Available one-step actions for the current expression
      </div>
      <ul class="actions" id="action-list"></ul>
      <div class="error" id="error"></div>

      <div class="section-title">Raw JSON payload (debug)</div>
      <div class="debug" id="debug"></div>
    </div>

    <script src="${KATEX_JS_PATH}"></script>
    <script>
      (function () {
        const INITIAL_LATEX = ${JSON.stringify(DEMO_LATEX)};
        const ACTIONS_URL = "${ACTIONS_PATH}";
        const INVARIANT_SET_ID = "${DEMO_INVARIANT_SET_ID}";
        const INVARIANT_ID = "${DEMO_INVARIANT_ID}";

        let currentLatex = INITIAL_LATEX;

        const exprContainer = document.getElementById("expr-container");
        const exprBox = document.getElementById("expr-box");
        const resetBtn = document.getElementById("reset-btn");
        const reloadBtn = document.getElementById("reload-btn");
        const actionList = document.getElementById("action-list");
        const errorEl = document.getElementById("error");
        const debugEl = document.getElementById("debug");

        function sanitizeLatexForDemo(input) {
          if (typeof input !== "string") return "";
          let s = input;

          // Our demo actions come in as strings with doubled backslashes,
          // e.g. "\\\\frac{1}{3} \\\\cdot 1 + \\\\frac{2}{5}".
          // For KaTeX we want single backslashes: "\\frac{1}{3} \\cdot 1 + \\frac{2}{5}".
          s = s.replace(/\\\\/g, "\\"); // collapse \\ -> \

          return s;
        }

        function renderExpression() {
          const latex = sanitizeLatexForDemo(currentLatex);
          if (window.katex) {
            window.katex.render(latex, exprContainer, {
              throwOnError: false,
            });
          } else {
            exprContainer.textContent = latex;
          }
        }

        function createActionItem(action) {
          const li = document.createElement("li");

          const header = document.createElement("div");
          header.className = "action-header";

          const kind = document.createElement("span");
          kind.className = "action-kind";
          kind.textContent = action.kind || "(kind)";

          const rule = document.createElement("span");
          rule.className = "action-rule";
          rule.textContent = action.ruleId || "";

          header.appendChild(kind);
          header.appendChild(rule);

          const student = document.createElement("div");
          student.className = "action-student";
          student.textContent = action.descriptionStudent || "";

          const teacher = document.createElement("div");
          teacher.className = "action-teacher";
          teacher.textContent = action.descriptionTeacher || "";

          const buttons = document.createElement("div");
          buttons.className = "action-buttons";

          const applyBtn = document.createElement("button");
          applyBtn.type = "button";
          applyBtn.textContent = "Apply this step";
          applyBtn.addEventListener("click", function () {
            if (!action.toLatexPreview) {
              window.alert(
                "This demo action has no 'toLatexPreview' field. Nothing to apply.",
              );
              return;
            }
            currentLatex = action.toLatexPreview;
            renderExpression();
            fetchActions();
          });

          buttons.appendChild(applyBtn);

          li.appendChild(header);
          li.appendChild(student);
          li.appendChild(teacher);
          li.appendChild(buttons);

          return li;
        }

        async function fetchActions() {
          errorEl.textContent = "";
          actionList.innerHTML = "";
          debugEl.textContent = "Loading actions...";

          try {
            const body = {
              invariantSetId: INVARIANT_SET_ID,
              invariantId: INVARIANT_ID,
              latex: currentLatex,
              selection: {
                primaryRegionId: "tsa-sum-of-two-fractions",
                allRegionIds: ["tsa-frac-1", "tsa-plus", "tsa-frac-2"],
              },
            };

            const res = await fetch(ACTIONS_URL, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(body),
            });

            if (!res.ok) {
              const text = await res.text();
              throw new Error("HTTP " + res.status + " – " + text);
            }

            const payload = await res.json();
            debugEl.textContent = JSON.stringify(payload, null, 2);

            const actions = (payload && payload.actions) || [];

            if (!actions.length) {
              const li = document.createElement("li");
              li.textContent =
                "No actions available for the current expression in this demo.";
              actionList.appendChild(li);
              return;
            }

            actions.forEach(function (a) {
              const item = createActionItem(a);
              actionList.appendChild(item);
            });
          } catch (err) {
            console.error(err);
            errorEl.textContent =
              "Error loading actions: " +
              (err && err.message ? err.message : String(err));
            debugEl.textContent = String(err && err.stack) || String(err);
          }
        }

        exprBox.addEventListener("click", function () {
          fetchActions();
        });

        resetBtn.addEventListener("click", function () {
          currentLatex = INITIAL_LATEX;
          renderExpression();
          fetchActions();
        });

        reloadBtn.addEventListener("click", function () {
          fetchActions();
        });

        renderExpression();
        fetchActions();
      })();
    </script>
  </body>
</html>`;

  res.end(html);
}

function readJsonBody(req: http.IncomingMessage): Promise<StepActionQuery> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    req
      .on("data", (chunk) => {
        chunks.push(chunk as Buffer);
      })
      .on("end", () => {
        try {
          const raw = Buffer.concat(chunks).toString("utf-8").trim();
          if (!raw) {
            reject(new Error("Empty request body"));
            return;
          }
          const parsed = JSON.parse(raw);
          resolve(parsed as StepActionQuery);
        } catch (err) {
          reject(err);
        }
      })
      .on("error", (err) => {
        reject(err);
      });
  });
}

async function handleActionsJson(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const query = await readJsonBody(req);
    const baseResponse: StepActionResponse =
      computeDemoActionsForFractions(query);

    const json = JSON.stringify(baseResponse, null, 2);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(json);
  } catch (err) {
    const message =
      err && (err as Error).message ? (err as Error).message : String(err);
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify(
        {
          error: "Bad Request",
          message,
        },
        null,
        2,
      ),
    );
  }
}

function sendStaticKatex(
  res: http.ServerResponse,
  fileName: string,
  contentType: string,
): void {
  const filePath = path.join(KATEX_DIR, fileName);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Not found");
      return;
    }
    res.statusCode = 200;
    res.setHeader("Content-Type", contentType);
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = req.url ?? "/";
  const method = req.method ?? "GET";

  if (method === "GET" && url === "/favicon.ico") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (method === "GET" && url === ROOT_PATH) {
    sendHtml(res);
    return;
  }

  if (method === "GET" && url === KATEX_CSS_PATH) {
    sendStaticKatex(res, "katex.min.css", "text/css; charset=utf-8");
    return;
  }

  if (method === "GET" && url === KATEX_JS_PATH) {
    sendStaticKatex(res, "katex.min.js", "application/javascript; charset=utf-8");
    return;
  }

  if (method === "POST" && url === ACTIONS_PATH) {
    void handleActionsJson(req, res);
    return;
  }

  res.statusCode = 404;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end("Not found");
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(
    `[step-actions-demo-server.B10] Listening on http://localhost:${PORT}${ROOT_PATH}`,
  );
});
