import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DiscoverSchemes from '../components/DiscoverSchemes';
import { schemeAPI } from '../services/api';

jest.mock('../services/api', () => ({
  schemeAPI: { listSchemes: jest.fn(), getFilterOptions: jest.fn() },
  collectionAPI: { getSavedIds: jest.fn(), saveScheme: jest.fn(), unsaveScheme: jest.fn() },
}));

const scheme = (id, extra = {}) => ({
  id, name: `Scheme ${id}`, description: `About scheme ${id}`, location: 'all_india',
  business_category: 'any', max_investment: '500000', rules: {}, benefits: { subsidy_percent: 25 },
  beneficiary_categories: [], verified: false, ...extra,
});

const page = (schemes, { page: p = 1, total = schemes.length, totalPages = 1 } = {}) => ({
  success: true,
  data: { schemes, pagination: { page: p, limit: 12, total, totalPages } },
});

const lastParams = () => schemeAPI.listSchemes.mock.calls[schemeAPI.listSchemes.mock.calls.length - 1][0];

beforeEach(() => {
  jest.resetAllMocks();
  schemeAPI.getFilterOptions.mockResolvedValue({ data: { categories: ['manufacturing', 'service'], locations: ['tamil_nadu'] } });
  schemeAPI.listSchemes.mockResolvedValue(page([scheme(1), scheme(2)]));
});

test('loads schemes and dropdown options from the API', async () => {
  render(<DiscoverSchemes onBack={() => {}} />);
  expect(await screen.findByText('Scheme 1')).toBeInTheDocument();
  expect(screen.getByText('2 schemes found')).toBeInTheDocument();
  expect(await screen.findByRole('option', { name: 'Tamil Nadu' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Manufacturing' })).toBeInTheDocument();
  expect(lastParams()).toMatchObject({ page: 1, limit: 12, sort: 'name', order: 'asc' });
});

test('state and category filters are sent to the server', async () => {
  render(<DiscoverSchemes onBack={() => {}} />);
  await screen.findByText('Scheme 1');
  await screen.findByRole('option', { name: 'Tamil Nadu' });

  await userEvent.selectOptions(screen.getByLabelText('State'), 'tamil_nadu');
  await waitFor(() => expect(lastParams()).toMatchObject({ state: 'tamil_nadu', page: 1 }));

  await userEvent.selectOptions(screen.getByLabelText('Business type'), 'manufacturing');
  await waitFor(() => expect(lastParams()).toMatchObject({ state: 'tamil_nadu', category: 'manufacturing' }));
});

test('search is debounced and sent as q', async () => {
  render(<DiscoverSchemes onBack={() => {}} />);
  await screen.findByText('Scheme 1');
  const before = schemeAPI.listSchemes.mock.calls.length;
  await userEvent.type(screen.getByLabelText('Search'), 'loan');
  await waitFor(() => expect(lastParams()).toMatchObject({ q: 'loan' }));
  // typing 4 letters must not fire 4 requests
  expect(schemeAPI.listSchemes.mock.calls.length - before).toBeLessThan(4);
});

test('initial query from the header search is applied', async () => {
  render(<DiscoverSchemes initialQuery="mudra" onBack={() => {}} />);
  await screen.findByText('Scheme 1');
  expect(schemeAPI.listSchemes.mock.calls[0][0]).toMatchObject({ q: 'mudra' });
  expect(screen.getByLabelText('Search')).toHaveValue('mudra');
});

test('project cost input keeps digits only', async () => {
  render(<DiscoverSchemes onBack={() => {}} />);
  await screen.findByText('Scheme 1');
  await userEvent.type(screen.getByLabelText('Your project cost (₹)'), '5a0,000');
  expect(screen.getByLabelText('Your project cost (₹)')).toHaveValue('50000');
  await waitFor(() => expect(lastParams()).toMatchObject({ investment: '50000' }));
});

test('clear filters resets everything', async () => {
  render(<DiscoverSchemes initialQuery="x" onBack={() => {}} />);
  await screen.findByText('Scheme 1');
  const clear = screen.getAllByRole('button', { name: 'Clear filters' })[0];
  expect(clear).toBeEnabled();
  await userEvent.click(clear);
  expect(screen.getByLabelText('Search')).toHaveValue('');
  await waitFor(() => expect(lastParams().q).toBe(''));
});

test('empty result shows a message', async () => {
  schemeAPI.listSchemes.mockResolvedValue(page([]));
  render(<DiscoverSchemes onBack={() => {}} />);
  expect(await screen.findByText('No schemes match these filters.')).toBeInTheDocument();
  expect(screen.getByText('0 schemes found')).toBeInTheDocument();
});

test('error shows message and retry works', async () => {
  schemeAPI.listSchemes.mockRejectedValueOnce({ response: { data: { message: 'Database down' } } });
  render(<DiscoverSchemes onBack={() => {}} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Database down');
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('Scheme 1')).toBeInTheDocument();
});

test('load more appends the next page', async () => {
  schemeAPI.listSchemes
    .mockResolvedValueOnce(page([scheme(1)], { total: 2, totalPages: 2 }))
    .mockResolvedValueOnce(page([scheme(2)], { page: 2, total: 2, totalPages: 2 }));
  render(<DiscoverSchemes onBack={() => {}} />);
  await screen.findByText('Scheme 1');
  await userEvent.click(screen.getByRole('button', { name: 'Load more (1 left)' }));
  expect(await screen.findByText('Scheme 2')).toBeInTheDocument();
  expect(screen.getByText('Scheme 1')).toBeInTheDocument();
  expect(lastParams()).toMatchObject({ page: 2 });
  expect(screen.queryByRole('button', { name: /Load more/ })).not.toBeInTheDocument();
});

test('view details opens the details view and back returns', async () => {
  render(<DiscoverSchemes onBack={() => {}} />);
  await screen.findByText('Scheme 1');
  await userEvent.click(screen.getAllByRole('button', { name: 'View details →' })[0]);
  expect(screen.getByRole('heading', { level: 1, name: 'Scheme 1' })).toBeInTheDocument();
  expect(screen.getByRole('note')).toHaveTextContent('not yet been checked');
  await userEvent.click(screen.getByRole('button', { name: '← Back to Schemes' }));
  expect(screen.getByText('Browse Schemes')).toBeInTheDocument();
});
