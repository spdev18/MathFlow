import http from "node:http";
import { BasicMapMaster } from "../../../../mapmaster-bridge/src/mapmaster.basic";
import { MapMasterEngineOrchestrator } from "../../../../mapmaster-bridge/src/mapmaster.engine-bridge";
import { NginHttpEngineClient } from "../../../../mapmaster-bridge/src/mapmaster.ngin-http-client";
import { buildMapMasterIntrospectSummary } from "../../../../mapmaster-bridge/src/mapmaster.introspect";
import type { MapMasterRequest } from "../../../../mapmaster-bridge/src/mapmaster.api";

const ENGINE_URL = "http://localhost:4201/api/entry-step";
const PORT = 4201;
const PATH = "/mapmaster-introspect";

const mapMaster = new BasicMapMaster();
const engineClient = new NginHttpEngineClient(ENGINE_URL);
const orchestrator = new MapMasterEngineOrchestrator(mapMaster, engineClient);

function log(message: string) {
  // eslint-disable-next-line no-console
  console.log(`[mapmaster-introspect-server] ${message}`);
}

function setCorsHeaders(res: http.ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

const server = http.createServer((req, res) => {
  if (!req.url) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    setCorsHeaders(res);
    res.end(
      JSON.stringify(
        { error: "Bad Request", message: "Request URL is missing." },
        null,
        2,
      ),
    );
    return;
  }

  if (req.method === "OPTIONS" && req.url === PATH) {
    // CORS preflight
    setCorsHeaders(res);
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === PATH) {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", async () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        const request = parsed as MapMasterRequest;

        const planResult = await orchestrator.planAndRun(request);

        const summary = buildMapMasterIntrospectSummary({
          request,
          plan: planResult.plan as any,
          chosenCandidateId: planResult.chosenCandidateId ?? null,
        });

        const payload = {
          source: "http" as const,
          summary,
        };

        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        setCorsHeaders(res);
        res.end(JSON.stringify(payload, null, 2));
      } catch (err: any) {
        log(`ERROR ${err?.stack || err}`);
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        setCorsHeaders(res);
        res.end(
          JSON.stringify(
            {
              error: "HTTP 500 Internal Server Error",
              message: String(err?.message || err),
            },
            null,
            2,
          ),
        );
      }
    });
    return;
  }

  res.statusCode = 404;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  setCorsHeaders(res);
  res.end("Not found");
});

server.listen(PORT, () => {
  log(`Listening on http://localhost:${PORT}${PATH} (engine: ${ENGINE_URL})`);
});
