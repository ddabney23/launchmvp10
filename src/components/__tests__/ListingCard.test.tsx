import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ListingCard } from '../ListingCard';
import { useCart } from '@/contexts/CartContext';

// Mock dependencies
vi.mock('@/contexts/CartContext', () => ({
  useCart: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  getProfile: vi.fn(() => Promise.resolve({ display_name: 'Test Vendor', username: 'vendor' })),
  isLiked: vi.fn(() => Promise.resolve(false)),
  getLikeCount: vi.fn(() => Promise.resolve(5)),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('ListingCard', () => {
  const mockListing = {
    id: 'listing-1',
    vendor: 'vendor-1',
    title: 'Test Product',
    description: 'Test description',
    price: 99.99,
    currency: 'USD',
    quantity: 10,
    active: true,
    images: ['https://example.com/image.jpg'],
    category: 'electronics',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    (useCart as any).mockReturnValue({
      addItem: vi.fn(),
    });
  });

  it('should render listing title', () => {
    render(<ListingCard listing={mockListing} />, { wrapper: createWrapper() });

    expect(screen.getByText('Test Product')).toBeInTheDocument();
  });

  it('should render listing price', () => {
    render(<ListingCard listing={mockListing} />, { wrapper: createWrapper() });

    expect(screen.getByText('$99.99')).toBeInTheDocument();
  });

  it('should show out of stock when quantity is 0', () => {
    const outOfStockListing = { ...mockListing, quantity: 0 };
    
    render(<ListingCard listing={outOfStockListing} />, { wrapper: createWrapper() });

    expect(screen.getByText('Out of Stock')).toBeInTheDocument();
  });
});

