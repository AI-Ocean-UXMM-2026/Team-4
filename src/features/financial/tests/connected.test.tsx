import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ConnectedFinancialPage } from '../pages/ConnectedFinancialPage';
import { formatMmk } from '../types';

const mocks = vi.hoisted(() => ({ api: vi.fn(), state: {
  isPending: false, isFetching: false, isError: false, error: new Error('Snapshot failed'),
  data: { business_id: 'A', source_version: 1 }, refetch: vi.fn(),
} }));
vi.mock('@/app/providers', () => ({ usePlatform: () => ({ business: { id: 'A', name: 'Imported Store' } }), useSnapshot: () => mocks.state }));
vi.mock('@/lib/apiClient', () => ({ api: mocks.api }));
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.isFetching = false;
  mocks.state.isError = false;
  mocks.state.data = { business_id: 'A', source_version: 1 };
  mocks.api.mockImplementation(async (path: string) => {
    const url = new URL(path, 'http://test');
    const common = { business_id: 'A', source_version: 1, import_batch_id: 'import-1', as_of: '2026-10-21T03:30:00Z' };
    if (url.pathname.endsWith('/trends')) return { ...common, points: [] };
    return { ...common, period: { start: url.searchParams.get('start'), end: url.searchParams.get('end') },
      actual: { revenue_mmk: '150.75', cogs_mmk: null, gross_profit_mmk: null, operating_expenses_mmk: '20.10', operating_profit_mmk: null, interest_expenses_mmk: '0.00', profit_before_tax_mmk: null, cash_balance_mmk: null, receivables_mmk: '80.40', payables_mmk: '20.00' },
      upcoming_obligations: [{ kind: 'supplier', reference_id: 'P', due_date: null, amount_mmk: '20.00' }],
      data_quality: { status: 'partial', missing_sheets: [], warnings: ['Historical cost and expense settlement unavailable.'] } };
  });
});

it('uses the shared authenticated client with active business and renders exact decimals', async () => {
  render(<ConnectedFinancialPage />);
  expect(await screen.findByText('150.75 MMK')).toBeTruthy();
  expect(screen.getByText('80.4 MMK')).toBeTruthy();
  expect(screen.getByText('Due date unavailable')).toBeTruthy();
  expect(mocks.api.mock.calls.every(([path, options]) => path.includes('business_id=A') && options.signal instanceof AbortSignal)).toBe(true);
});

it('hides cards immediately when the shared import query refetches', async () => {
  const view = render(<ConnectedFinancialPage />);
  await screen.findByText('150.75 MMK');
  mocks.state.isFetching = true;
  view.rerender(<ConnectedFinancialPage />);
  expect(screen.queryByText('150.75 MMK')).toBeNull();
  expect(screen.getByRole('status')).toBeTruthy();
});

it('rejects old financial source versions after the shared import is updated', async () => {
  const view = render(<ConnectedFinancialPage />);
  await screen.findByText('150.75 MMK');
  mocks.state.data = { business_id: 'A', source_version: 2 };
  await act(async () => view.rerender(<ConnectedFinancialPage />));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('stale or inconsistent'));
  expect(screen.queryByText('150.75 MMK')).toBeNull();
});

it('shows no-workbook state instead of fake totals', async () => {
  mocks.state.data = { business_id: 'A', source_version: 0 };
  render(<ConnectedFinancialPage />);
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('No workbook imported'));
  expect(mocks.api).not.toHaveBeenCalled();
});

it('formats large decimal amounts without floating-point loss', () => {
  expect(formatMmk('9999999999999999.99')).toBe('9,999,999,999,999,999.99 MMK');
  expect(formatMmk('-0.25')).toBe('-0.25 MMK');
});
