// DOM Event handling with options
export interface CustomEventHandler<T = any> {
  (event: CustomEvent<T>): void | Promise<void>;
}

export interface EventOptions {
  capture?: boolean;
  passive?: boolean;
  once?: boolean;
  signal?: AbortSignal;
}

// DOM Element extensions with more features
export interface CustomElement extends HTMLElement {
  /** Custom data attributes */
  dataset: {
    [key: string]: string | number | boolean;
  };
  /** Custom event handlers */
  addEventListener<T>(type: string, listener: CustomEventHandler<T>, options?: EventOptions): void;
  removeEventListener<T>(type: string, listener: CustomEventHandler<T>, options?: EventOptions): void;
  /** Custom methods */
  scrollIntoView(options?: ScrollIntoViewOptions): Promise<void>;
  matches(selectors: string): boolean;
}

// Enhanced Mutation Observer types
export interface MutationConfig {
  /** Watch for changes to the attribute */
  attributes?: boolean;
  /** Watch for changes to the children */
  childList?: boolean;
  /** Watch for changes to the descendants */
  subtree?: boolean;
  /** Record attribute old value */
  attributeOldValue?: boolean;
  /** Filter specific attributes */
  attributeFilter?: string[];
  /** Record character data old value */
  characterDataOldValue?: boolean;
}

// Enhanced ResizeObserver types
export interface ResizeEntry {
  target: Element;
  contentRect: DOMRectReadOnly;
  borderBoxSize: ReadonlyArray<ResizeObserverSize>;
  contentBoxSize: ReadonlyArray<ResizeObserverSize>;
  devicePixelContentBoxSize: ReadonlyArray<ResizeObserverSize>;
}

// Element position and size with viewport
export interface ElementMetrics {
  width: number;
  height: number;
  top: number;
  left: number;
  right: number;
  bottom: number;
  /** Viewport relative positions */
  viewport: {
    top: number;
    left: number;
    visible: boolean;
  };
} 