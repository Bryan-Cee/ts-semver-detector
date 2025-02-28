import { ReactNode, RefObject } from 'react';

// Global window extensions
declare global {
  interface Window {
    /** Analytics tracking function */
    trackEvent: (eventName: string, data: Record<string, unknown>) => void;
    /** Feature flags */
    featureFlags: {
      enableDarkMode: boolean;
      betaFeatures: boolean;
    };
  }
}

// Intersection Observer options
export interface IntersectionOptions {
  root?: Element | null;
  rootMargin?: string;
  threshold?: number | number[];
}

// Virtual scroll container
export interface VirtualScrollProps {
  /** Items to render */
  items: unknown[];
  /** Height of each item */
  itemHeight: number;
  /** Container height */
  height: number;
  /** Render function for items */
  renderItem: (item: unknown, index: number) => ReactNode;
  /** Buffer size */
  overscanCount?: number;
}

// Event bus for cross-component communication
export type EventCallback = (data: unknown) => void;
export interface EventBus {
  on(event: string, callback: EventCallback): void;
  off(event: string, callback: EventCallback): void;
  emit(event: string, data: unknown): void;
}

// DOM Ref utilities
export interface DOMUtils {
  /** Get element dimensions */
  getDimensions(element: HTMLElement): { width: number; height: number };
  /** Check if element is visible */
  isVisible(element: HTMLElement): boolean;
  /** Get element offset from document */
  getOffset(element: HTMLElement): { top: number; left: number };
}

// Service worker registration options
export interface ServiceWorkerOptions {
  scope: string;
  updateViaCache?: 'all' | 'none' | 'imports';
  registrationStrategy?: 'registerImmediately' | 'registerWhenStable' | 'registerWhenOnline';
}

// Web storage wrapper
export interface StorageWrapper {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
  clear(): void;
}

// Drag and drop context
export interface DragContext<T> {
  item: T;
  source: {
    index: number;
    droppableId: string;
  };
  destination?: {
    index: number;
    droppableId: string;
  };
} 