import { ReactNode, RefObject, MutableRefObject } from 'react';

// Global window extensions
declare global {
  interface Window {
    /** Analytics tracking function */
    trackEvent: (eventName: string, data: Record<string, any>, options?: { debug?: boolean }) => Promise<void>;
    /** Feature flags */
    featureFlags: {
      enableDarkMode: boolean;
      betaFeatures: boolean;
      experiments: Record<string, boolean>;
    };
    /** Performance monitoring */
    performance: {
      mark(name: string): void;
      measure(name: string, startMark: string, endMark: string): void;
    } & Performance;
  }
}

// Intersection Observer options with callback
export interface IntersectionOptions {
  root?: Element | null;
  rootMargin?: string;
  threshold?: number | number[];
  onIntersect?: (entries: IntersectionObserverEntry[]) => void;
}

// Virtual scroll container with generic type
export interface VirtualScrollProps<T> {
  /** Items to render */
  items: T[];
  /** Height of each item */
  itemHeight: number | ((item: T) => number);
  /** Container height */
  height: number;
  /** Render function for items */
  renderItem: (item: T, index: number) => ReactNode;
  /** Buffer size */
  overscanCount?: number;
  /** Scroll position restoration */
  restoreScrollPosition?: boolean;
}

// Enhanced event bus with type safety
export type EventCallback<T = unknown> = (data: T) => void | Promise<void>;
export interface EventBus {
  on<T>(event: string, callback: EventCallback<T>): void;
  off<T>(event: string, callback: EventCallback<T>): void;
  emit<T>(event: string, data: T): void;
  once<T>(event: string, callback: EventCallback<T>): void;
}

// DOM Ref utilities with additional methods
export interface DOMUtils {
  /** Get element dimensions */
  getDimensions(element: HTMLElement): { width: number; height: number; scrollWidth: number; scrollHeight: number };
  /** Check if element is visible */
  isVisible(element: HTMLElement): boolean;
  /** Get element offset from document */
  getOffset(element: HTMLElement): { top: number; left: number };
  /** Check if element is in viewport */
  isInViewport(element: HTMLElement, offset?: number): boolean;
  /** Scroll element into view */
  scrollIntoView(element: HTMLElement, options?: ScrollIntoViewOptions): void;
}

// Service worker registration options with callbacks
export interface ServiceWorkerOptions {
  scope: string;
  updateViaCache?: 'all' | 'none' | 'imports';
  registrationStrategy?: 'registerImmediately' | 'registerWhenStable' | 'registerWhenOnline';
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
}

// Web storage wrapper with expiration
export interface StorageWrapper {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T, options?: { expires?: number; encrypt?: boolean }): void;
  remove(key: string): void;
  clear(): void;
  clearExpired(): void;
}

// Enhanced drag and drop context
export interface DragContext<T> {
  item: T;
  source: {
    index: number;
    droppableId: string;
    container: HTMLElement;
  };
  destination?: {
    index: number;
    droppableId: string;
    container: HTMLElement;
  };
  dropEffect?: 'none' | 'copy' | 'link' | 'move';
  isDragging: boolean;
} 