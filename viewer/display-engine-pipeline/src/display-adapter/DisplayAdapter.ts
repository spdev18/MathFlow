/**
 * DisplayAdapter - translates Display events into normalized ClientEvents
 * and publishes them to the FileBus
 */

import type { DisplayEvent, DisplayPublicApi } from "./DisplayPublicApi.js";
import type { ClientEvent } from "../protocol/types.js";
import type { FileBus } from "../filebus/FileBus.js";

export class DisplayAdapter {
  constructor(
    private displayApi: DisplayPublicApi,
    private bus: FileBus
  ) {
    this.displayApi.on(this.handleDisplayEvent);
  }

  private handleDisplayEvent = (displayEvent: DisplayEvent): void => {
    const clientEvent = this.toClientEvent(displayEvent);
    this.bus.publishClientEvent(clientEvent);
  };

  private toClientEvent(displayEvent: DisplayEvent): ClientEvent {
    const base: ClientEvent = {
      type: displayEvent.type as ClientEvent["type"],
      timestamp: displayEvent.timestamp,
      latex: this.displayApi.getLatex(),
      surfaceNodeId: displayEvent.surfaceNodeId,
    };

    // Map selection
    if (displayEvent.selection) {
      base.selection = displayEvent.selection.selectedIds;
    }

    // Map click details
    if (displayEvent.click) {
      base.click = {
        button: displayEvent.click.button === 0 ? "left" : "right",
        clickCount: displayEvent.click.detail === 2 ? 2 : 1,
        modifiers: {
          shift: displayEvent.click.shiftKey,
          ctrl: displayEvent.click.ctrlKey,
          alt: displayEvent.click.altKey,
        },
      };
    }

    // Map hover details
    if (displayEvent.hover) {
      base.hover = {
        nodeKind: displayEvent.hover.nodeKind,
        nodeRole: displayEvent.hover.nodeRole,
        latexFragment: displayEvent.hover.latexFragment,
      };
    }

    // Handle drag selection (multi-select)
    if (displayEvent.type === "selectionChanged" && displayEvent.selection) {
      const sel = displayEvent.selection;
      if (sel.mode === "multi" || sel.mode === "rect") {
        base.type = "dragSelect";
        base.drag = {
          selectedNodes: sel.selectedIds,
          selectionMode: sel.mode,
        };
      }
    }

    return base;
  }

  detach(): void {
    this.displayApi.off(this.handleDisplayEvent);
  }
}
