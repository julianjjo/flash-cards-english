import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import Home from './Home';

beforeEach(() => {
  global.fetch = jest.fn(() => Promise.resolve({
    json: () => Promise.resolve([
      { id: 1, en: 'test', es: 'prueba', level: 0, nextReview: new Date().toISOString() }
    ]),
    ok: true
  }));
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Home page', () => {
  test('muestra tarjetas para repaso', async () => {
    render(<Home />);
    await waitFor(() => expect(screen.getByText(/test/i)).toBeInTheDocument());
    expect(screen.getByText(/prueba/i)).toBeInTheDocument();
  });

  test('muestra mensaje si no hay tarjetas', async () => {
    global.fetch = jest.fn(() => Promise.resolve({ json: () => Promise.resolve([]), ok: true }));
    render(<Home />);
    await waitFor(() => expect(screen.getByText(/No hay tarjetas/i)).toBeInTheDocument());
  });
});
