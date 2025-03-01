import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '../../test/utils';
import userEvent from '@testing-library/user-event';
import { SemanticAnalysisForm } from '../SemanticAnalysisForm';
import { apiRequest } from '@/lib/queryClient';

// Mock the API request function
vi.mock('@/lib/queryClient', () => ({
  apiRequest: vi.fn()
}));

describe('SemanticAnalysisForm', () => {
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('submits text content for analysis', async () => {
    const user = userEvent.setup();
    (apiRequest as any).mockResolvedValueOnce({ nodes: [], edges: [] });

    render(<SemanticAnalysisForm onSuccess={mockOnSuccess} />);

    const textInput = screen.getByLabelText(/enter text/i);
    await user.type(textInput, 'Test content for analysis');
    
    const submitButton = screen.getByRole('button', { name: /analyze/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith('/api/graph/analyze', {
        method: 'POST',
        body: { text: 'Test content for analysis', images: [] }
      });
    });
  });

  it('validates required text input', async () => {
    const user = userEvent.setup();
    render(<SemanticAnalysisForm onSuccess={mockOnSuccess} />);

    const submitButton = screen.getByRole('button', { name: /analyze/i });
    await user.click(submitButton);

    expect(await screen.findByText(/text is required/i)).toBeInTheDocument();
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('shows loading state during submission', async () => {
    const user = userEvent.setup();
    (apiRequest as any).mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    render(<SemanticAnalysisForm onSuccess={mockOnSuccess} />);

    const textInput = screen.getByLabelText(/enter text/i);
    await user.type(textInput, 'Test content');
    
    const submitButton = screen.getByRole('button', { name: /analyze/i });
    await user.click(submitButton);

    expect(screen.getByRole('button', { name: /analyzing/i })).toBeDisabled();
  });

  it('handles API errors gracefully', async () => {
    const user = userEvent.setup();
    (apiRequest as any).mockRejectedValueOnce(new Error('API Error'));

    render(<SemanticAnalysisForm onSuccess={mockOnSuccess} />);

    const textInput = screen.getByLabelText(/enter text/i);
    await user.type(textInput, 'Test content');
    
    const submitButton = screen.getByRole('button', { name: /analyze/i });
    await user.click(submitButton);

    expect(await screen.findByText(/failed to analyze content/i)).toBeInTheDocument();
  });
});
