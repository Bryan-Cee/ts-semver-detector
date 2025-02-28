import { ReactNode } from 'react';

export interface ButtonProps {
  /** The button's content */
  children: ReactNode;
  /** The button's variant */
  variant: 'primary' | 'secondary';
  /** Click handler */
  onClick: () => void;
  /** Optional class name */
  className?: string;
}

export interface CardProps {
  /** Card title */
  title: string;
  /** Card content */
  children: ReactNode;
} 