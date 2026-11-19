import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SavedSchemesProvider, useSavedSchemes } from '../context/SavedSchemesContext';
import SaveButton from '../components/SaveButton';
import { collectionAPI } from '../services/api';

jest.mock('../services/api', () => ({
  collectionAPI: {
    getSavedIds: jest.fn(),
    saveScheme: jest.fn(),
    unsaveScheme: jest.fn(),
  },
}));

const ErrorText = () => {
  const { error } = useSavedSchemes();
  return error ? <p role="alert">{error}</p> : null;
};

const renderWith = (props = {}, ids = [1, 2]) => render(
  <SavedSchemesProvider isLoggedIn onRequireLogin={jest.fn()} {...props}>
    {ids.map((id) => <SaveButton key={id} schemeId={id} />)}
    <ErrorText />
  </SavedSchemesProvider>
);

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

beforeEach(() => {
  jest.resetAllMocks();
  collectionAPI.getSavedIds.mockResolvedValue({ data: { ids: [2] } });
});

test('loads saved ids once and shows hearts accordingly', async () => {
  renderWith();
  const [one, two] = screen.getAllByRole('button');
  await waitFor(() => expect(two).toHaveAttribute('aria-pressed', 'true'));
  expect(one).toHaveAttribute('aria-pressed', 'false');
  expect(collectionAPI.getSavedIds).toHaveBeenCalledTimes(1);
});

test('save is optimistic: heart fills before the request finishes', async () => {
  const d = deferred();
  collectionAPI.saveScheme.mockReturnValue(d.promise);
  renderWith();
  const [one] = screen.getAllByRole('button');
  await waitFor(() => expect(collectionAPI.getSavedIds).toHaveBeenCalled());

  await userEvent.click(one);
  expect(one).toHaveAttribute('aria-pressed', 'true');
  expect(one).toBeDisabled(); // pending
  expect(collectionAPI.saveScheme).toHaveBeenCalledWith(1);

  await act(async () => d.resolve({ success: true }));
  expect(one).toHaveAttribute('aria-pressed', 'true');
  expect(one).not.toBeDisabled();
});

test('clicking a saved heart unsaves it', async () => {
  collectionAPI.unsaveScheme.mockResolvedValue({ success: true });
  renderWith();
  const two = screen.getAllByRole('button')[1];
  await waitFor(() => expect(two).toHaveAttribute('aria-pressed', 'true'));
  await userEvent.click(two);
  expect(collectionAPI.unsaveScheme).toHaveBeenCalledWith(2);
  expect(collectionAPI.saveScheme).not.toHaveBeenCalled();
  await waitFor(() => expect(two).toHaveAttribute('aria-pressed', 'false'));
});

test('failed save rolls back and shows an error', async () => {
  collectionAPI.saveScheme.mockRejectedValue({ response: { data: { message: 'Server said no' } } });
  renderWith();
  const [one] = screen.getAllByRole('button');
  await waitFor(() => expect(collectionAPI.getSavedIds).toHaveBeenCalled());
  await userEvent.click(one);
  await waitFor(() => expect(one).toHaveAttribute('aria-pressed', 'false'));
  expect(screen.getByRole('alert')).toHaveTextContent('Server said no');
});

test('double click while pending sends only one request', async () => {
  const d = deferred();
  collectionAPI.saveScheme.mockReturnValue(d.promise);
  renderWith();
  const [one] = screen.getAllByRole('button');
  await waitFor(() => expect(collectionAPI.getSavedIds).toHaveBeenCalled());
  await userEvent.click(one);
  await userEvent.click(one); // disabled, ignored
  await act(async () => d.resolve({}));
  expect(collectionAPI.saveScheme).toHaveBeenCalledTimes(1);
});

test('logged out: clicking asks to sign in and calls no API', async () => {
  const onRequireLogin = jest.fn();
  renderWith({ isLoggedIn: false, onRequireLogin });
  const [one] = screen.getAllByRole('button');
  expect(one).toHaveAccessibleName('Sign in to save this scheme');
  await userEvent.click(one);
  expect(onRequireLogin).toHaveBeenCalledTimes(1);
  expect(collectionAPI.getSavedIds).not.toHaveBeenCalled();
  expect(collectionAPI.saveScheme).not.toHaveBeenCalled();
});

test('logging out clears saved state', async () => {
  const { rerender } = renderWith();
  const two = screen.getAllByRole('button')[1];
  await waitFor(() => expect(two).toHaveAttribute('aria-pressed', 'true'));
  rerender(
    <SavedSchemesProvider isLoggedIn={false} onRequireLogin={jest.fn()}>
      <SaveButton schemeId={1} />
      <SaveButton schemeId={2} />
    </SavedSchemesProvider>
  );
  expect(screen.getAllByRole('button')[1]).toHaveAttribute('aria-pressed', 'false');
});
