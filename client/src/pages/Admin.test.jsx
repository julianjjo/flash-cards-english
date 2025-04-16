import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Admin from './Admin';

// Mock fetch global
beforeEach(() => {
  global.fetch = jest.fn(() => Promise.resolve({
    json: () => Promise.resolve([]),
    ok: true
  }));
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Admin page', () => {
  test('renderiza el formulario para nueva tarjeta', () => {
    render(<Admin />);
    expect(screen.getByPlaceholderText(/inglés/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/español/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Agregar/i })).toBeInTheDocument();
  });

  test('deshabilita el botón y muestra loading al agregar', async () => {
    render(<Admin />);
    fireEvent.change(screen.getByPlaceholderText(/inglés/i), { target: { value: 'test' } });
    fireEvent.change(screen.getByPlaceholderText(/español/i), { target: { value: 'prueba' } });
    fireEvent.click(screen.getByRole('button', { name: /Agregar/i }));
    expect(screen.getByRole('button', { name: /Agregar/i })).toBeDisabled();
    expect(screen.getByTestId('loading')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: /Agregar/i })).not.toBeDisabled());
  });
});
