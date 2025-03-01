import { ReactElement } from 'react';
import { render as rtlRender } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from './setup';

interface WrapperProps {
  children: React.ReactNode;
}

export function createWrapper() {
  const queryClient = createTestQueryClient();
  return function Wrapper({ children }: WrapperProps) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

export function render(ui: ReactElement, options = {}) {
  return rtlRender(ui, { wrapper: createWrapper(), ...options });
}

// Re-export everything
export * from '@testing-library/react';
