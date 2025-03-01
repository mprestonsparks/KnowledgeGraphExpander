import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../App';

// Mock console.error to catch asset loading issues
const originalError = console.error;
const errors: string[] = [];

describe('App Loading', () => {
  beforeAll(() => {
    console.error = (...args: any[]) => {
      errors.push(args.join(' '));
    };
    return () => {
      console.error = originalError;
    };
  });

  it('should load without asset errors', () => {
    render(<App />);
    const assetErrors = errors.filter(error => 
      error.includes('Failed to load resource') || 
      error.includes('Error loading') ||
      error.includes('404')
    );
    expect(assetErrors).toHaveLength(0);
  });

  it('should render main application components', () => {
    render(<App />);
    // Check for key UI elements that should always be present
    expect(screen.getByRole('main')).toBeInTheDocument();
  });
});
