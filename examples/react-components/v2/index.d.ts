import { ReactNode } from 'react';

export interface ButtonProps {
  /** The button's content */
  children: ReactNode;
  /** The button's variant */
  variant: 'primary' | 'secondary' | 'tertiary';
  /** Click handler */
  onClick: () => void;
  /** Optional class name */
  className?: string;
  /** Optional disabled state */
  disabled?: boolean;
}

export interface CardProps {
  /** Card title */
  title: string;
  /** Card content */
  children: ReactNode;
  /** Card size */
  size: 'small' | 'medium' | 'large';
} 