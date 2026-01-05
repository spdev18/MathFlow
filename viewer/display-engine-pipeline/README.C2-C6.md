# C2–C6: Display → Engine pipeline

This package contains the bridge from the interactive Display (KaTeX + SNM) to the math engine (NGIN).  
It covers components C2–C6:

- **C2 – DisplayAdapter**: converts UI events into normalized protocol messages.
- **C3 – FileBus**: in‑memory event bus.
- **C4 – Recorder / Player**: JSONL trace recorder and scenario replayer.
- **C5 – EngineAdapter**: translates bus messages into engine calls (embedded stub or HTTP).
- **C6 – Launcher**: CLI entry point that wires everything together.

The goal is to keep all of these pieces isolated, testable and engine‑agnostic.

---

## Folder layout

```text
src/
  display-adapter/
  engine-adapter/
  filebus/
  protocol/
  recorder/
  launcher/
config/
  dev.example.json
scenarios/
  example-session.jsonl
logs/
  (runtime logs; empty in repo)
```

---

## Scripts

All commands are run from `viewer/display-engine-pipeline`:

```bash
# Compile TypeScript → dist/
npm run build

# Run test suite (Node 20+, uses tsx)
npm test

# Demo mode: embedded stub engine, no recorder
npm run demo

# Dev mode: embedded engine + Recorder writing JSONL logs
npm run dev

# Replay a recorded scenario
npm run test:replay
```

These scripts expect Node 20+ and `pnpm` or `npm` to install dev dependencies.

---

## Runtime architecture

At runtime the components are wired as:

```text
Display (KaTeX + SNM)
   ↓  (hover / click / drag events)
DisplayPublicApi
   ↓
DisplayAdapter          (C2)
   ↓  ClientEvent
FileBus                 (C3)
   ↓  EngineRequest / EngineResponse
EngineAdapter           (C5)
   ↓
Engine (embedded stub or HTTP endpoint)

Recorder / Player       (C4, optional)
   ↕
JSONL log files
```

### DisplayPublicApi / DisplayAdapter (C2)

`DisplayPublicApi` is a very small surface that the Display uses:

- `setLatex(latex: string)` — update the current expression.
- `onEvent(handler)` — subscribe to UI events.

`DisplayAdapter` subscribes to this API and converts everything into `ClientEvent` objects defined in `src/protocol/types.ts`, then publishes them into `FileBus`.

The real Display code lives in a separate package and should only depend on `DisplayPublicApi` (not on FileBus or Engine).

### FileBus (C3)

`FileBus` is an in‑memory pub/sub:

- Synchronous and asynchronous subscribers.
- Bounded history (for simple debugging).
- Strong typing via `BusMessage`.

Nothing here knows about the engine or the Display – it only passes messages.

### Recorder / Player (C4)

Recorder:

- Listens to `BusMessage` traffic.
- Writes one JSON object per line into a `.jsonl` file.
- Can rotate files by `sessionPrefix` + timestamp.
- Optional `autoFlush` for safer debugging runs.

Player:

- Reads JSONL line‑by‑line.
- Skips comments and invalid lines.
- Re‑publishes valid `BusMessage` objects back into a `FileBus`.
- Can respect recorded timing or play back as fast as possible.

### EngineAdapter (C5)

Wraps the actual engine. Two modes:

- **`mode: "embedded"`** — uses the local `StubEngine` implementation.
- **`mode: "http"`** — sends requests to an HTTP endpoint (`httpEndpoint`, `httpTimeout`).

It subscribes to `ClientEvent` messages on the bus and publishes:

- `EngineRequest` — what the engine should do (parse, preview step, apply step, get hints).
- `EngineResponse` — updated LaTeX, hints, error info, etc.

The adapter is the only place that knows how to talk to the engine.

### Launcher / RuntimeContext (C6)

`RuntimeContext` wires everything together based on a `LauncherConfig`.  
`launcher.mts` is a small CLI wrapper around it:

- Reads CLI options: `--mode`, `--config`, `--scenario`.
- Loads JSON config file if provided.
- Applies mode‑specific defaults:
  - `demo`: embedded engine only.
  - `dev`: embedded engine + Recorder to `./logs`.
  - `test`: embedded engine + Player reading a scenario file.
- Prints effective configuration to the console.
- Starts the runtime and keeps the process alive until interrupted.

---

## Configuration

Example config file: `config/dev.example.json`.

Key sections:

- `fileBus` — name and history size.
- `engineAdapter` — mode + HTTP options.
- `recorder` — output directory, file prefix, flushing rules.
- `testScenario` — path to a JSONL scenario for `test` mode.

To create your own `dev` config:

```bash
cp config/dev.example.json config/dev.json
# edit config/dev.json to point to your engine, log folder, etc.
```

Then run:

```bash
npm run build
npm run dev
```

---

## Scenarios and logs

- Scenarios live under `scenarios/` as JSONL.
- Dev logs are written into `logs/` (ignored by git except for `.gitkeep`).

Both files are plain text and can be inspected, diffed and replayed.

---

## Integration with the Display bundle

To integrate with the Display package:

1. Instantiate `DisplayPublicApi` in the Display code.
2. Wire Display mouse events (hover, click, drag‑select) into the public API.
3. Let `DisplayAdapter` and `EngineAdapter` handle the rest via `FileBus`.

No engine logic should leak into the Display; no DOM logic should leak into the EngineAdapter.

