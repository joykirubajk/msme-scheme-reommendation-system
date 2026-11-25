import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dashboard from '../components/Dashboard';
import { SavedSchemesProvider } from '../context/SavedSchemesContext';
import { collectionAPI, profileAPI, schemeAPI } from '../services/api';

jest.mock('../services/api', () => ({
  collectionAPI: { getSavedSchemes: jest.fn(), getSavedIds: jest.fn(), saveScheme: jest.fn(), unsaveScheme: jest.fn() },
  profileAPI: { getProfile: jest.fn() },
  schemeAPI: { recommendSchemes: jest.fn(), listSchemes: jest.fn() },
}));

const user = { id: 1, name: 'Asha Kumar', email: 'asha@example.com' };

const renderDashboard = (props = {}) =>
  render(
    <SavedSchemesProvider isLoggedIn onRequireLogin={jest.fn()}>
      <Dashboard user={user} onBack={jest.fn()} onFindSchemes={jest.fn()} onBrowse={jest.fn()} {...props} />
    </SavedSchemesProvider>
  );

beforeEach(() => {
  jest.resetAllMocks();
  collectionAPI.getSavedIds.mockResolvedValue({ data: { ids: [3] } });
  collectionAPI.getSavedSchemes.mockResolvedValue({
    data: { schemes: [{ id: 3, name: 'Saved Scheme', saved_at: '2026-11-01T00:00:00Z' }] },
  });
  schemeAPI.listSchemes.mockResolvedValue({ data: { schemes: [], pagination: { total: 22 } } });
});

test('shows profile, top matches and saved schemes', async () => {
  profileAPI.getProfile.mockResolvedValue({
    data: { profile: { business_category: 'manufacturing', state: 'tamil_nadu', investment: 500000 } },
  });
  schemeAPI.recommendSchemes.mockResolvedValue({
    eligible_count: 1,
    possible_count: 1,
    ranked_by: 'ml',
    data: [
      { id: 1, name: 'Scheme A', tier: 'eligible', score: 0.9, reasons: ['Matches your state'] },
      { id: 2, name: 'Scheme B', tier: 'possibly_eligible', score: 0.4, reasons: [] },
    ],
  });

  renderDashboard();

  expect(screen.getByRole('heading', { name: 'Welcome back, Asha' })).toBeInTheDocument();
  expect(await screen.findByText('Scheme A')).toBeInTheDocument();
  expect(screen.getByText('Matches your state')).toBeInTheDocument();
  expect(screen.getByText('Possibly eligible', { selector: '.dashboard-tier' })).toBeInTheDocument();
  expect(screen.getByText('Manufacturing')).toBeInTheDocument();
  expect(screen.getByText('Tamil Nadu')).toBeInTheDocument();
  expect(await screen.findByText('Saved Scheme')).toBeInTheDocument();
  expect(await screen.findByText('22')).toBeInTheDocument();
  // Uses the saved profile (no profile in the request body)
  expect(schemeAPI.recommendSchemes).toHaveBeenCalledWith({});
});

test('prompts to create a profile when none is saved', async () => {
  profileAPI.getProfile.mockResolvedValue({ data: { profile: null } });
  const onFindSchemes = jest.fn();

  renderDashboard({ onFindSchemes });

  const cta = await screen.findByRole('button', { name: 'Find your schemes' });
  expect(schemeAPI.recommendSchemes).not.toHaveBeenCalled();
  await userEvent.click(cta);
  expect(onFindSchemes).toHaveBeenCalled();
});

test('shows an error when recommendations fail', async () => {
  profileAPI.getProfile.mockResolvedValue({ data: { profile: { state: 'kerala' } } });
  schemeAPI.recommendSchemes.mockRejectedValue({ response: { data: { message: 'Missing or invalid profile fields' } } });

  renderDashboard();

  expect(await screen.findByText('Missing or invalid profile fields')).toBeInTheDocument();
});
