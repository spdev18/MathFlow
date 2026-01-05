// display-adapter.js
// Browser-only DisplayAdapter + simple JSONL recorder for ClientEvent.
// This is a minimal implementation based on our Display ↔ Engine protocol draft.

/**
 * DisplayAdapter normalizes UI events (hover/click/selection) into
 * a flat ClientEvent object that can later be sent to FileBus/Engine.
 */
export class DisplayAdapter {
  /**
   * @param {() => string} getLatex - function returning current canonical LaTeX
   * @param {() => {mode:string, primaryId:string|null, selectedIds:Set<string>}} getSelectionState
   * @param {(evt: any) => void} onClientEvent - callback that receives normalized ClientEvent
   */
  constructor(getLatex, getSelectionState, onClientEvent) {
    this._getLatex = typeof getLatex === "function" ? getLatex : () => "";
    this._getSelectionState = typeof getSelectionState === "function" ? getSelectionState : () => null;
    this._onClientEvent = typeof onClientEvent === "function" ? onClientEvent : () => { };
  }

  /**
   * Hover over an atomic surface node.
   * @param {any} node - SurfaceNode or null
   * @param {PointerEvent} e
   */
  emitHover(node, e) {
    const evt = this._baseEvent("hover", node, e);
    this._emit(evt);
  }

  /**
   * Pointer click on a node (after selection engine has updated selectionState).
   * @param {any} node
   * @param {PointerEvent} e
   */
  emitClick(node, e) {
    console.log("[VIEWER-CLICK] Raw Click Target:", {
      nodeId: node ? node.id : "null",
      kind: node ? node.kind : "null",
      role: node ? node.role : "null",
      latexFragment: node ? node.latexFragment : "null",
      operatorIndex: node ? node.operatorIndex : "undefined",
      astNodeId: node ? node.astNodeId : "undefined",
      latex: this._getLatex()
    });

    const evt = this._baseEvent("click", node, e);
    evt.click = {
      button: e.button === 2 ? "right" : "left",
      clickCount: e.detail >= 2 ? 2 : 1,
      modifiers: {
        shift: !!e.shiftKey,
        alt: !!e.altKey,
        ctrl: !!e.ctrlKey,
        meta: !!e.metaKey,
      },
    };
    this._attachSelection(evt);
    this._emit(evt);
  }

  /**
   * Selection changed as a result of drag-rect or click.
   * @param {"rect"|"click"} source
   * @param {PointerEvent} e
   */
  emitSelectionChanged(source, e) {
    const evt = this._baseEvent("selectionChanged", null, e);
    this._attachSelection(evt);
    evt.selectionSource = source;
    this._emit(evt);
  }

  /**
   * Internal helper: common frame for all ClientEvent objects.
   * @param {"hover"|"click"|"selectionChanged"} type
   * @param {any} node
   * @param {PointerEvent} e
   * @returns {any}
   */
  _baseEvent(type, node, e) {
    const latex = this._getLatex();
    const operatorIndex =
      node && typeof node.operatorIndex === "number" && Number.isFinite(node.operatorIndex)
        ? node.operatorIndex
        : undefined;
    const astNodeId =
      node && node.astNodeId ? String(node.astNodeId) : undefined;
    const astOperatorIndex =
      node && typeof node.astOperatorIndex === "number" && Number.isFinite(node.astOperatorIndex)
        ? node.astOperatorIndex
        : undefined;

    return {
      type,
      timestamp: Date.now(),
      latex: typeof latex === "string" ? latex : "",
      surfaceNodeId: node && node.id ? String(node.id) : undefined,
      surfaceNodeKind: node && node.kind ? String(node.kind) : undefined,
      surfaceNodeRole: node && node.role ? String(node.role) : undefined,
      surfaceNodeText: node && node.latexFragment ? String(node.latexFragment) : undefined, // NEW: operator symbol ("+", "-", etc.)
      surfaceOperatorIndex: operatorIndex,
      astNodeId: astNodeId, // AST node ID for backend
      astOperatorIndex: astOperatorIndex, // NEW: Local operator index within AST node
      pointer: e
        ? {
          clientX: e.clientX,
          clientY: e.clientY,
        }
        : undefined,
    };
  }

  /**
   * Internal helper: attach selection snapshot (mode + ids) to event.
   * @param {any} evt
   */
  _attachSelection(evt) {
    const sel = this._getSelectionState && this._getSelectionState();
    if (!sel) return;
    const ids =
      sel.selectedIds instanceof Set
        ? Array.from(sel.selectedIds)
        : sel.selectedIds || [];
    evt.selection = ids.map(String);
    evt.selectionMode = sel.mode || "none";
    evt.selectionPrimaryId =
      sel.primaryId !== undefined && sel.primaryId !== null
        ? String(sel.primaryId)
        : null;
  }

  /**
   * Internal helper: safely emit event to consumer.
   * @param {any} evt
   */
  _emit(evt) {
    try {
      this._onClientEvent(evt);
    } catch (err) {
      console.error("[DisplayAdapter] onClientEvent error", err);
    }
  }
}

/**
 * Simple in-browser recorder that collects ClientEvent objects
 * and allows downloading them as a JSONL file.
 */
export class ClientEventRecorder {
  constructor() {
    /** @type {any[]} */
    this.events = [];
  }

  /**
   * Handler compatible with DisplayAdapter's onClientEvent callback.
   * @param {any} evt
   */
  handleEvent(evt) {
    this.events.push(evt);
    // Mirror to console for quick inspection
    console.log("[ClientEvent]", evt);
  }

  /** Clear all recorded events. */
  clear() {
    this.events = [];
  }

  /**
   * Download recorded events as JSONL.
   * @param {string} [filename]
   */
  download(filename = "client-events.jsonl") {
    if (!this.events.length) {
      console.warn("[ClientEventRecorder] No events to download");
    }
    const lines = this.events.map((e) => JSON.stringify(e));
    const blob = new Blob([lines.join("\n") + "\n"], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
