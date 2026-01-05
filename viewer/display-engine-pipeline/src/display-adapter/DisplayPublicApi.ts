/**
 * DisplayPublicApi - thin API layer that the Display uses to emit events
 * The DisplayAdapter will attach to this API to receive events
 */

export type DisplayEventType = "hover" | "click" | "dblclick" | "context" | "selectionChanged";

export interface DisplayEvent {
  type: DisplayEventType;
  timestamp: number;
  surfaceNodeId?: string;
  selection?: {
    mode: "none" | "single" | "multi" | "rect";
    primaryId: string | null;
    selectedIds: string[];
  };
  click?: {
    button: number; // 0=left, 2=right
    detail: number; // clickCount
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
  };
  hover?: {
    nodeId: string;
    nodeKind: string;
    nodeRole: string;
    latexFragment: string;
  };
}

export type DisplayEventHandler = (event: DisplayEvent) => void;

export class DisplayPublicApi {
  private handlers: Set<DisplayEventHandler> = new Set();
  private currentLatex: string = "";

  setLatex(latex: string): void {
    this.currentLatex = latex;
  }

  getLatex(): string {
    return this.currentLatex;
  }

  on(handler: DisplayEventHandler): void {
    this.handlers.add(handler);
  }

  off(handler: DisplayEventHandler): void {
    this.handlers.delete(handler);
  }

  emit(event: DisplayEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (err) {
        console.error("[DisplayPublicApi] Handler error:", err);
      }
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}
