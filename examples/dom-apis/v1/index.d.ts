// DOM Event handling
export interface CustomEventHandler<T = any> {
  (event: CustomEvent<T>): void;
}

// DOM Element extensions
export interface CustomElement extends HTMLElement {
  /** Custom data attributes */
  dataset: {
    [key: string]: string;
  };
  /** Custom event handlers */
  addEventListener<T>(type: string, listener: CustomEventHandler<T>): void;
  removeEventListener<T>(type: string, listener: CustomEventHandler<T>): void;
}

// Mutation Observer types
export interface MutationConfig {
  /** Watch for changes to the attribute */
  attributes?: boolean;
  /** Watch for changes to the children */
  childList?: boolean;
  /** Watch for changes to the descendants */
  subtree?: boolean;
  /** Record attribute old value */
  attributeOldValue?: boolean;
}

// ResizeObserver types
export interface ResizeEntry {
  target: Element;
  contentRect: DOMRectReadOnly;
}

// Element position and size
export interface ElementMetrics {
  width: number;
  height: number;
  top: number;
  left: number;
  right: number;
  bottom: number;
} 