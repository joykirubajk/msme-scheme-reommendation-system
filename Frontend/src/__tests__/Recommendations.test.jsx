import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RecommendedSchemes from '../components/RecommendedSchemes';
import RecommendationForm from '../components/RecommendationForm';
import { schemeAPI, profileAPI } from '../services/api';

jest.mock('../services/api', () => ({
  schemeAPI: { recommendSchemes: jest.fn() },
  profileAPI: { getProfile: jest.fn() },
  collectionAPI: { getSavedIds: jest.fn(), saveScheme: jest.fn(), unsaveScheme: jest.fn() },
}));

const rec = (id, tier, extra = {}) => ({
  id, name: `Scheme ${id}`, description: 'desc', tier, score: 0.42, location: 'tamil_nadu',
  business_category: 'any', rules: {}, benefits: {}, beneficiary_categories: [],
  reasons: ['Matches your business description'],
  eligibility: { passedRules: [{ message: 'Age 30 is within 18-55' }], missingInputs: tier === 'possibly_eligible' ? ['income'] : [] },
  ...extra,
});

describe('RecommendedSchemes', () => {
  test('shows tiers, counts, score and missing inputs', () => {
    render(<RecommendedSchemes schemes={[rec(1, 'eligible'), rec(2, 'possibly_eligible')]} isLoading={false} rankedBy="ml" />);
    expect(screen.getByText(/Found/)).toHaveTextContent('Found 1 eligible and 1 possibly eligible');
    expect(screen.getByText('Eligible')).toBeInTheDocument();
    expect(screen.getByText('Possibly eligible')).toBeInTheDocument();
    expect(screen.getAllByText('Match 42%')).toHaveLength(2);
    expect(screen.getByText('Add to confirm: annual income')).toBeInTheDocument();
    expect(screen.queryByText(/simpler method/)).not.toBeInTheDocument();
  });

  test('fallback ranking shows a notice', () => {
    render(<RecommendedSchemes schemes={[rec(1, 'eligible')]} isLoading={false} rankedBy="fallback" />);
    expect(screen.getByText(/simpler method/)).toBeInTheDocument();
  });

  test('"Why this matched" expands reasons and passed rules', async () => {
    render(<RecommendedSchemes schemes={[rec(1, 'eligible')]} isLoading={false} rankedBy="ml" />);
    await userEvent.click(screen.getByRole('button', { name: 'Why this matched' }));
    expect(screen.getByText('Matches your business description')).toBeInTheDocument();
    expect(screen.getByText(/Age 30 is within 18-55/)).toBeInTheDocument();
  });

  test('loading and empty states', () => {
    const { rerender } = render(<RecommendedSchemes schemes={[]} isLoading rankedBy={null} />);
    expect(screen.getByText(/Finding eligible schemes/)).toBeInTheDocument();
    rerender(<RecommendedSchemes schemes={[]} isLoading={false} rankedBy={null} />);
    expect(screen.getByText(/No schemes found/)).toBeInTheDocument();
  });

  test('every card has a save button', () => {
    render(<RecommendedSchemes schemes={[rec(1, 'eligible'), rec(2, 'eligible')]} isLoading={false} rankedBy="ml" />);
    expect(screen.getAllByRole('button', { name: /save this scheme/i })).toHaveLength(2);
  });
});

describe('RecommendationForm', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    profileAPI.getProfile.mockRejectedValue(new Error('no profile'));
  });

  const fillRequired = async () => {
    await userEvent.type(screen.getByLabelText(/^Age/), '30');
    await userEvent.selectOptions(screen.getByLabelText(/^Gender/), 'female');
    await userEvent.selectOptions(screen.getByLabelText(/^Business Category/), 'manufacturing');
    await userEvent.type(screen.getByLabelText(/^Investment Amount/), '500000');
    await userEvent.selectOptions(screen.getByLabelText(/^(Location|State)/), 'tamil_nadu');
  };

  test('blocks submit and lists errors when required fields are empty', async () => {
    const { container } = render(<RecommendationForm onRecommendations={jest.fn()} onLoading={jest.fn()} />);
    container.querySelector('form').noValidate = true; // skip native HTML validation, test ours
    await userEvent.click(screen.getByRole('button', { name: /find|get|recommend/i }));
    expect(screen.getAllByText('Please enter a valid age').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Please select a gender').length).toBeGreaterThan(0);
    expect(schemeAPI.recommendSchemes).not.toHaveBeenCalled();
  });

  test('rejects an age under 18', async () => {
    const { container } = render(<RecommendationForm onRecommendations={jest.fn()} onLoading={jest.fn()} />);
    container.querySelector('form').noValidate = true;
    await fillRequired();
    await userEvent.clear(screen.getByLabelText(/^Age/));
    await userEvent.type(screen.getByLabelText(/^Age/), '15');
    await userEvent.click(screen.getByRole('button', { name: /find|get|recommend/i }));
    expect(screen.getAllByText('Please enter a valid age').length).toBeGreaterThan(0);
    expect(schemeAPI.recommendSchemes).not.toHaveBeenCalled();
  });

  test('sends the API profile shape and passes results up', async () => {
    schemeAPI.recommendSchemes.mockResolvedValue({ data: [rec(1, 'eligible')], ranked_by: 'ml' });
    const onRecommendations = jest.fn();
    render(<RecommendationForm onRecommendations={onRecommendations} onLoading={jest.fn()} />);
    await fillRequired();
    await userEvent.click(screen.getByRole('button', { name: /find|get|recommend/i }));
    await waitFor(() => expect(onRecommendations).toHaveBeenCalled());
    const body = schemeAPI.recommendSchemes.mock.calls[0][0];
    expect(body.profile).toMatchObject({
      age: 30, gender: 'female', business_category: 'manufacturing', investment: 500000, state: 'tamil_nadu',
      annual_income: null, experience_years: null,
    });
    expect(onRecommendations).toHaveBeenCalledWith([expect.objectContaining({ id: 1 })], { ranked_by: 'ml' });
  });

  test('shows server field errors', async () => {
    schemeAPI.recommendSchemes.mockRejectedValue({ response: { data: { errors: [{ field: 'state', message: 'state must be a valid state name' }] } } });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<RecommendationForm onRecommendations={jest.fn()} onLoading={jest.fn()} />);
    await fillRequired();
    await userEvent.click(screen.getByRole('button', { name: /find|get|recommend/i }));
    expect(await screen.findAllByText(/state must be a valid state name/)).not.toHaveLength(0);
  });

  test('pre-fills from the saved business profile', async () => {
    profileAPI.getProfile.mockResolvedValue({ data: { profile: { age: 41, gender: 'male', state: 'maharashtra', business_category: 'retail', investment: 200000 } } });
    render(<RecommendationForm onRecommendations={jest.fn()} onLoading={jest.fn()} />);
    await waitFor(() => expect(screen.getByLabelText(/^Age/)).toHaveValue(41));
    expect(screen.getByLabelText(/^Business Category/)).toHaveValue('retail');
  });
});
