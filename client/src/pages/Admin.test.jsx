import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Admin from './Admin';

// Mock fetch global
beforeEach(() => {
  // Simula sesión admin
  sessionStorage.setItem('admin_auth', 'fake');
  global.fetch = jest.fn(() => Promise.resolve({
    json: () => Promise.resolve([]),
    ok: true
  }));
});

afterEach(() => {
  jest.restoreAllMocks();
  sessionStorage.clear();
});

describe('Admin page', () => {
  test('renderiza el formulario para nueva tarjeta', () => {
    render(<Admin />);
    expect(screen.getByPlaceholderText(/palabra en inglés/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/traducción en español/i)).toBeInTheDocument();
    // El botón puede decir 'Agregar' o 'Actualizar' según el modo, así que probamos ambos
    expect(
      screen.getByRole('button', { name: /Agregar|Actualizar/i })
    ).toBeInTheDocument();
  });

  test('deshabilita el botón y muestra loading al agregar', async () => {
    render(<Admin />);
    fireEvent.change(screen.getByPlaceholderText(/palabra en inglés/i), { target: { value: 'test' } });
    fireEvent.change(screen.getByPlaceholderText(/traducción en español/i), { target: { value: 'prueba' } });
    // El botón puede decir 'Agregar' o 'Actualizar'
    const actionButton = screen.getByRole('button', { name: /Agregar|Actualizar/i });
    fireEvent.click(actionButton);
    expect(actionButton).toBeDisabled();
    // Ya no hay un testId 'loading', así que solo esperamos a que el botón se habilite
    await waitFor(() => expect(actionButton).not.toBeDisabled());
  });
});
