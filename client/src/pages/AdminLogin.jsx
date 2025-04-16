import React, { useState } from 'react';

export default function AdminLogin({ onLogin }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    if (!user || !pass) return setError('Completa ambos campos');
    // Probar credenciales con un fetch protegido
    const basic = btoa(`${user}:${pass}`);
    const res = await fetch('/api/cards', {
      headers: { Authorization: `Basic ${basic}` }
    });
    if (res.status === 401) return setError('Credenciales incorrectas');
    // Guardar en sessionStorage
    sessionStorage.setItem('admin_auth', basic);
    onLogin();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <form onSubmit={handleSubmit} className="bg-white shadow rounded p-6 flex flex-col gap-4 w-80">
        <h2 className="text-xl font-bold">Admin Login</h2>
        <input
          type="text"
          placeholder="Usuario"
          value={user}
          onChange={e => setUser(e.target.value)}
          className="border rounded px-3 py-2"
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={pass}
          onChange={e => setPass(e.target.value)}
          className="border rounded px-3 py-2"
        />
        {error && <div className="text-red-500 text-sm">{error}</div>}
        <button type="submit" className="bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700">Entrar</button>
      </form>
    </div>
  );
}
