/**
 * engineHttpServer.ts
 *
 * Thin HTTP wrapper around HandlerPostEntryStep for Backend API v1.
 */

import http, {
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

import {
  HandlerPostEntryStep,
  type HandlerDeps,
} from "./HandlerPostEntryStep.js";
import {
  HandlerPostUndoStep,
} from "./HandlerPostUndoStep.js";
import {
  handlePostHintRequest,
} from "./HandlerPostHintRequest.js";
import { handleGetStudentProgress } from "./HandlerReporting.js";
import type { EngineStepResponse, UndoStepResponse, HintResponse } from "../protocol/backend-step.types.js";
import { StepSnapshotStore } from "../debug/StepSnapshotStore.js";

import type { Logger } from "pino";

export interface EngineHttpServerOptions {
  port: number;
  handlerDeps: HandlerDeps;
  logger?: Logger;
}

export interface EngineHttpServer {
  start(): Promise<number>;
  stop(): Promise<void>;
}

export function createEngineHttpServer(
  options: EngineHttpServerOptions,
): EngineHttpServer {
  const { port, handlerDeps, logger } = options;
  // Fallback if no logger provided (though we expect one)
  const logInfo = (msg: string) => logger ? logger.info(msg) : console.log(msg);
  const logError = (obj: object, msg: string) => logger ? logger.error(obj, msg) : console.error(msg, obj);

  const server = http.createServer(
    async (req: IncomingMessage, res: ServerResponse) => {
      // Enable CORS
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-trace-id");

      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      const rawUrl = req.url ?? "/";
      const [urlPath] = rawUrl.split("?", 2);
      const url = urlPath || "/";

      // POST /api/entry-step (TzV1.1)
      // We also support /engine/step for backward compatibility if needed, 
      // but TZ specifies /api/entry-step.
      // STUDENT-FACING ENGINE ENDPOINT:
      // This endpoint is called by the main Viewer/Adapter in the learning flow.
      // It MUST NOT depend on any debug-only endpoints.
      if (req.method === "POST" && (
        url === "/api/entry-step" ||
        url === "/engine/step" ||
        url === "/api/undo-step" ||
        url === "/api/hint-request" ||
        url === "/api/register" ||
        url === "/api/login" ||
        url === "/api/ast-debug" ||
        url === "/api/mapmaster-debug" ||
        url === "/api/mapmaster-global-map" ||
        url === "/api/step-debug" ||
        url === "/api/step-debug" ||
        url === "/api/primitive-map-debug" ||
        url === "/api/orchestrator/v5/step" ||
        url === "/api/instrument"
      )) {
        let body = "";

        req.on("data", (chunk: Buffer | string) => {
          body += chunk.toString();
        });

        req.on("end", async () => {
          let parsedBody: unknown;

          try {
            parsedBody = body.length > 0 ? JSON.parse(body) : null;
          } catch (error) {
            const message =
              error instanceof Error
                ? error.message
                : "Invalid JSON in request body.";

            logError({ err: error }, `[EngineHttpServer] JSON parse error: ${message}`);

            const errorResponse: EngineStepResponse = {
              status: "engine-error",
              expressionLatex: "", // Cannot echo back if JSON is invalid
            };

            sendJson(res, 400, errorResponse);
            return;
          }

          try {
            let response: unknown;

            // POST /api/entry-step (TzV1.1)
            // We also support /engine/step for backward compatibility if needed,
            // but TZ specifies /api/entry-step.
            if (url === "/api/entry-step" || url === "/engine/step") {
              response = await HandlerPostEntryStep(
                parsedBody,
                handlerDeps,
              );
            }
            else if (url === "/api/undo-step") {
              response = await HandlerPostUndoStep(parsedBody, handlerDeps);
            }
            else if (url === "/api/hint-request") {
              response = await handlePostHintRequest(parsedBody, handlerDeps);
            }
            else if (url === "/api/ast-debug") {
              // DEBUG/TOOLS ONLY:
              // This endpoint is used exclusively by viewer/debug-tool.html (Dev Tool).
              // It MUST NOT be called from the student-facing Viewer/Adapter or main UI.
              const { handlePostAstDebug } = await import("./HandlerPostAstDebug.js");
              await handlePostAstDebug(req, res, parsedBody);
              return; // Handler sends response
            }
            else if (url === "/api/mapmaster-debug") {
              // DEBUG/TOOLS ONLY:
              // This endpoint is used exclusively by viewer/debug-tool.html (Dev Tool).
              // It MUST NOT be called from the student-facing Viewer/Adapter or main UI.
              const { handlePostMapMasterDebug } = await import("./HandlerPostMapMasterDebug.js");
              await handlePostMapMasterDebug(req, res, parsedBody);
              return; // Handler sends response
            }
            else if (url === "/api/mapmaster-global-map") {
              // DEBUG/TOOLS ONLY:
              // This endpoint is used exclusively by viewer/debug-tool.html (Dev Tool).
              // It MUST NOT be called from the student-facing Viewer/Adapter or main UI.
              const { handlePostMapMasterGlobalMap } = await import("./HandlerPostMapMasterGlobalMap.js");
              await handlePostMapMasterGlobalMap(req, res, parsedBody);
              return; // Handler sends response
            }
            else if (url === "/api/step-debug") {
              // DEBUG/TOOLS ONLY:
              // This endpoint is used exclusively by viewer/debug-tool.html (Dev Tool).
              // It MUST NOT be called from the student-facing Viewer/Adapter or main UI.
              const { handlePostStepDebug } = await import("./HandlerPostStepDebug.js");
              await handlePostStepDebug(req, res, parsedBody);
              return; // Handler sends response
            }
            else if (url === "/api/primitive-map-debug") {
              // DEBUG/TOOLS ONLY:
              // This endpoint is used exclusively by viewer/debug-tool.html (Dev Tool).
              // It MUST NOT be called from the student-facing Viewer/Adapter or main UI.
              const { handlePostPrimitiveMapDebug } = await import("./HandlerPostPrimitiveMapDebug.js");
              await handlePostPrimitiveMapDebug(req, res, parsedBody);
              return; // Handler sends response
            }
            else if (url === "/api/orchestrator/v5/step") {
              // NEW V5 ENDPOINT
              const { handlePostOrchestratorStepV5 } = await import("./HandlerPostOrchestratorStepV5.js");
              const result = await handlePostOrchestratorStepV5(parsedBody, handlerDeps);
              response = result;
            }
            else if (url === "/api/instrument") {
              // STABLE-ID INSTRUMENTATION ENDPOINT
              // Returns instrumented LaTeX with data-ast-id wrappers
              const { handlePostInstrument } = await import("./HandlerPostInstrument.js");
              await handlePostInstrument(req, res, parsedBody);
              return; // Handler sends response
            }
            // POST /api/register
            // else if (url === "/api/register") {
            //   response = await handlePostRegister(parsedBody, handlerDeps);
            // }
            // POST /api/login
            // else if (url === "/api/login") {
            //   response = await handlePostLogin(parsedBody, handlerDeps);
            // }
            else {
              // If it's a POST request but not a recognized path
              sendJson(res, 404, {
                status: "engine-error",
                message: "POST route not found.",
              });
              return;
            }

            sendJson(res, 200, response);
          } catch (error) {
            const message =
              error instanceof Error
                ? error.message
                : "Unexpected error in HTTP server.";

            logError({ err: error }, `[EngineHttpServer] Unhandled error: ${message}`);

            const errorResponse: EngineStepResponse = {
              status: "engine-error",
              expressionLatex: "",
            };

            sendJson(res, 500, errorResponse);
          }
        });

        return;
      }

      if (req.method === "GET" && url === "/health") {
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.end("ok");
        return;
      }

      if (req.method === "GET" && url === "/api/teacher/student-progress") {
        await handleGetStudentProgress(req, res);
        return;
      }

      if (req.method === "GET" && req.url === "/debug/step-snapshot/latest") {
        const snapshot = StepSnapshotStore.getLatest();
        if (snapshot) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(snapshot));
        } else {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "No step snapshot available" }));
        }
        return;
      }

      if (req.method === "GET" && req.url === "/debug/step-snapshot/session") {
        const snapshots = StepSnapshotStore.getSessionSnapshots();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(snapshots));
        return;
      }

      if (req.method === "POST" && req.url === "/debug/step-snapshot/reset") {
        StepSnapshotStore.resetSession();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", message: "Step snapshot session reset" }));
        return;
      }

      // ============================================================
      // TRACEHUB DEBUG ENDPOINTS
      // ============================================================

      if (req.method === "GET" && req.url === "/debug/trace/latest") {
        const { TraceHub } = await import("../debug/TraceHub.js");
        const count = TraceHub.count();
        const lastTraceId = TraceHub.getLastTraceId();
        const lastStepId = TraceHub.getLastStepId();
        const lastNEvents = TraceHub.getLastN(20);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          count,
          lastTraceId,
          lastStepId,
          lastNEvents
        }));
        return;
      }

      if (req.method === "GET" && req.url === "/debug/trace/download") {
        const { TraceHub } = await import("../debug/TraceHub.js");
        const jsonl = TraceHub.toJsonl();
        const filename = `tracehub-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`;

        res.writeHead(200, {
          "Content-Type": "application/x-ndjson",
          "Content-Disposition": `attachment; filename="${filename}"`
        });
        res.end(jsonl);
        return;
      }

      if (req.method === "POST" && req.url === "/debug/trace/reset") {
        const { TraceHub } = await import("../debug/TraceHub.js");
        TraceHub.reset();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", message: "TraceHub buffer reset" }));
        return;
      }

      // ============================================================
      // AST PATH RESOLVER DEBUG ENDPOINT
      // ============================================================

      if (req.method === "POST" && req.url === "/debug/ast/resolve-path") {
        let body = "";
        req.on("data", (chunk: Buffer | string) => {
          body += chunk.toString();
        });

        req.on("end", async () => {
          try {
            const parsedBody = JSON.parse(body);
            const { latex, selectionPath } = parsedBody as { latex?: string; selectionPath?: string };

            if (!latex || typeof latex !== "string") {
              sendJson(res, 400, {
                ok: false,
                error: "invalid-request",
                message: "Missing or invalid 'latex' field"
              });
              return;
            }

            if (!selectionPath || typeof selectionPath !== "string") {
              sendJson(res, 400, {
                ok: false,
                error: "invalid-request",
                message: "Missing or invalid 'selectionPath' field"
              });
              return;
            }

            // Import AST utilities
            const { parseExpression, getNodeAt } = await import("../mapmaster/ast.js");

            // Parse the latex to AST
            let ast;
            try {
              ast = parseExpression(latex);
            } catch (parseError) {
              sendJson(res, 200, {
                ok: false,
                error: "parse-failed",
                message: `Failed to parse LaTeX: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
                latex
              });
              return;
            }

            if (!ast) {
              sendJson(res, 200, {
                ok: false,
                error: "parse-failed",
                message: "AST parsing returned null",
                latex
              });
              return;
            }

            // Resolve the path
            const resolvedNode = getNodeAt(ast, selectionPath);

            if (!resolvedNode) {
              sendJson(res, 200, {
                ok: false,
                error: "path-not-found",
                message: `Path '${selectionPath}' not found in AST`,
                latex,
                selectionPath,
                astRootType: ast.type
              });
              return;
            }

            // Return successful resolution
            const nodeValue = (resolvedNode as { value?: string | number }).value ?? null;
            const latexFragment = (resolvedNode as { latex?: string }).latex ?? null;

            sendJson(res, 200, {
              ok: true,
              selectionPath,
              resolvedType: resolvedNode.type,
              resolvedKind: resolvedNode.type, // Using type as kind for now
              value: nodeValue,
              latexFragment: latexFragment || (nodeValue !== null ? String(nodeValue) : null),
              nodeKeys: Object.keys(resolvedNode)
            });

          } catch (error) {
            sendJson(res, 500, {
              ok: false,
              error: "resolver-error",
              message: error instanceof Error ? error.message : String(error)
            });
          }
        });
        return;
      }

      // ============================================================
      // SMART OPERATOR SELECTION: VALIDATION ENDPOINT
      // ============================================================

      if (req.method === "POST" && req.url === "/api/v1/validate-operator") {
        let body = "";
        req.on("data", (chunk: Buffer | string) => {
          body += chunk.toString();
        });

        req.on("end", async () => {
          try {
            const parsedBody = JSON.parse(body);
            const { latex, operatorPath } = parsedBody as { latex?: string; operatorPath?: string };

            if (!latex || typeof latex !== "string") {
              sendJson(res, 400, {
                ok: false,
                error: "invalid-request",
                message: "Missing or invalid 'latex' field"
              });
              return;
            }

            // Import validation utility from Phase 1
            const { validateOperatorContext } = await import("../mapmaster/validation.utils.js");

            // Validate the operator context
            const path = operatorPath || "root";
            const result = validateOperatorContext(latex, path);

            if (!result) {
              sendJson(res, 200, {
                ok: false,
                validationType: null,
                reason: "validation-failed",
                message: "Could not validate operator at path",
                latex,
                operatorPath: path
              });
              return;
            }

            // Return validation result
            sendJson(res, 200, {
              ok: true,
              validationType: result.validationType,
              reason: result.reason,
              operatorType: result.operatorType,
              leftOperandType: result.leftOperandType,
              rightOperandType: result.rightOperandType,
              latex,
              operatorPath: path
            });

          } catch (error) {
            sendJson(res, 500, {
              ok: false,
              error: "validation-error",
              message: error instanceof Error ? error.message : String(error)
            });
          }
        });
        return;
      }

      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(
        JSON.stringify({
          status: "engine-error",
          message: "Route not found.",
        }),
      );
    },
  );

  return {
    start(): Promise<number> {
      return new Promise((resolve) => {
        server.listen(port, () => {
          const address = server.address();
          const actualPort =
            typeof address === "object" && address && "port" in address
              ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (address as any).port
              : port;

          logInfo(
            `[EngineHttpServer] Developed by Shivam Pandey (https://linkedin.com/in/spdev912)`,
          );
          logInfo(
            `[EngineHttpServer] Listening on http://localhost:${actualPort}/api/entry-step`,
          );

          resolve(actualPort);
        });
      });
    },

    stop(): Promise<void> {
      return new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) {
            reject(err);
            return;
          }
          logInfo("[EngineHttpServer] Stopped.");
          resolve();
        });
      });
    },
  };
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  // CORS headers are already set in the request handler
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}