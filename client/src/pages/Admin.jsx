import React, { useEffect, useState } from 'react';
import AdminLogin from './AdminLogin';

const API_URL = '\/api/cards';

function Admin() {
  const [regenerating, setRegenerating] = useState({});
  const [loggedIn, setLoggedIn] = useState(!!sessionStorage.getItem('admin_auth'));
  // Si no está logueado, mostrar el login
  if (!loggedIn) return <AdminLogin onLogin={() => setLoggedIn(true)} />;

  const [cards, setCards] = useState([]);
  const [page, setPage] = useState(1);
  const CARDS_PER_PAGE = 10;
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ en: '', es: '' });
  const [editId, setEditId] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [existingAudio, setExistingAudio] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dueCards, setDueCards] = useState([]);
  const [now, setNow] = useState(Date.now());

  // Intervalos en ms para calcular la barra visual (deben coincidir con backend)
  const intervals = [
    1 * 60 * 1000,         // 1 min
    30 * 60 * 1000,        // 30 min
    60 * 60 * 1000,        // 1 hora
    6 * 60 * 60 * 1000,    // 6 horas
    24 * 60 * 60 * 1000,   // 1 día
    3 * 24 * 60 * 60 * 1000, // 3 días
    7 * 24 * 60 * 60 * 1000, // 7 días
    14 * 24 * 60 * 60 * 1000, // 14 días
    30 * 24 * 60 * 60 * 1000  // 30 días
  ];

  const fetchDueCards = () => {
    fetch('\/api/cards\/next', {
      headers: { Authorization: `Basic ${sessionStorage.getItem('admin_auth')}` }
    })
      .then(res => res.json())
      .then(data => setDueCards(data));
  };

  useEffect(() => {
    if (loggedIn) {
      fetchCards();
      fetchDueCards();
    }
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [loggedIn]);

  // ... resto igual ...

  const fetchCards = () => {
    setLoading(true);
    fetch(API_URL, {
      headers: { Authorization: `Basic ${sessionStorage.getItem('admin_auth')}` }
    })
      .then(res => res.json())
      .then(data => {
        setCards(data);
        setLoading(false);
      });
  };



  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAudioChange = e => {
    setAudioFile(e.target.files[0] || null);
  };

  const handleSubmit = e => {
    e.preventDefault();
    if (!form.en.trim() || !form.es.trim()) {
      setError('Completa ambos campos');
      return;
    }
    setError('');
    setSubmitting(true);
    const headers = { Authorization: `Basic ${sessionStorage.getItem('admin_auth')}` };
    let body, contentType;
    if (audioFile) {
      // Usar FormData si hay audio
      const fd = new FormData();
      fd.append('en', form.en);
      fd.append('es', form.es);
      fd.append('audio', audioFile);
      body = fd;
      // No seteamos content-type, el navegador lo hace
      contentType = undefined;
    } else {
      body = JSON.stringify(form);
      contentType = 'application/json';
    }
    const opts = {
      method: editId ? 'PUT' : 'POST',
      headers: contentType ? { ...headers, 'Content-Type': contentType } : headers,
      body
    };
    const url = editId ? `${API_URL}/${editId}` : API_URL;
    fetch(url, opts)
      .then(() => {
        setForm({ en: '', es: '' });
        setEditId(null);
        setAudioFile(null);
        setExistingAudio(null);
        fetchCards();
      })
      .finally(() => setSubmitting(false));
  };

  const handleEdit = card => {
    setForm({ en: card.en, es: card.es });
    setEditId(card.id);
    setError('');
    setExistingAudio(card.audio_url || null);
    setAudioFile(null);
  };

  const handleDelete = id => {
    if (!window.confirm('¿Eliminar esta tarjeta?')) return;
    fetch(`${API_URL}/${id}`, { method: 'DELETE', headers: { Authorization: `Basic ${sessionStorage.getItem('admin_auth')}` } }).then(fetchCards);
  };

  const handleCancel = () => {
    setForm({ en: '', es: '' });
    setEditId(null);
    setError('');
    setAudioFile(null);
    setExistingAudio(null);
  };

  return (
    <div className="max-w-xl mx-auto">
      <h2 className="text-2xl font-semibold mb-4">Administrar Tarjetas</h2>
      {/* Próximas a repasar */}
      <div className="mb-6">
        <h3 className="font-semibold mb-2 text-lg text-green-700">Próximas a repasar</h3>
        {dueCards.length === 0 ? (
          <div className="text-gray-400">No hay tarjetas por repasar ahora.</div>
        ) : (
          <ul className="flex flex-col gap-3">
            {dueCards.map(card => {
              // Calcular progreso visual
              const level = card.level || 0;
              const prevInterval = intervals[Math.max(0, level - 1)] || 0;
              const nextInterval = intervals[Math.min(level, intervals.length - 1)];
              const lastReview = new Date(new Date(card.nextReview).getTime() - nextInterval);
              const nextReview = new Date(card.nextReview);
              const progress = Math.min(1, Math.max(0, (now - lastReview.getTime()) / (nextReview - lastReview)));
              const timeLeftMs = nextReview - now;
              // Formato amigable
              function formatTime(ms) {
                if (ms <= 0) return '¡Listo para repasar!';
                const s = Math.floor(ms / 1000) % 60;
                const m = Math.floor(ms / 60000) % 60;
                const h = Math.floor(ms / 3600000) % 24;
                const d = Math.floor(ms / 86400000);
                let parts = [];
                if (d) parts.push(`${d}d`);
                if (h) parts.push(`${h}h`);
                if (m) parts.push(`${m}m`);
                if (s) parts.push(`${s}s`);
                return parts.join(' ');
              }
              return (
                <li key={card.id} className="bg-green-50 rounded p-3 shadow flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-blue-700">{card.en}</span> → <span className="text-gray-700">{card.es}</span>
                    </div>
                    <button
                      className="ml-4 px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition"
                      onClick={async () => {
                        await fetch(`/api/cards/${card.id}/review`, { method: 'POST', headers: { Authorization: `Basic ${sessionStorage.getItem('admin_auth')}` } });
                        fetchDueCards();
                        fetchCards();
                      }}
                    >Repasada</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-3 bg-green-200 rounded overflow-hidden">
                      <div
                        className="h-3 bg-green-500 transition-all"
                        style={{ width: `${progress * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-600 whitespace-nowrap min-w-[80px] text-right">
                      {formatTime(timeLeftMs)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <form onSubmit={handleSubmit} className="bg-white shadow rounded p-6 flex flex-col gap-4 mb-8">
        <div className="flex gap-2">
          <input
            type="text"
            name="en"
            placeholder="Palabra en inglés"
            className="border rounded px-3 py-2 w-1/2"
            value={form.en}
            onChange={handleChange}
            autoFocus
          />
          <input
            type="text"
            name="es"
            placeholder="Traducción en español"
            className="border rounded px-3 py-2 w-1/2"
            value={form.es}
            onChange={handleChange}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-medium">Audio (opcional):</label>
          <input type="file" accept="audio/*" onChange={handleAudioChange} />
          {audioFile && <span className="text-xs text-gray-600">Archivo: {audioFile.name}</span>}
          {existingAudio && !audioFile && (
            <span className="text-xs text-green-700">Ya existe audio. Si seleccionas uno nuevo, lo reemplazas.</span>
          )}
        </div>
        {error && <div className="text-red-500 text-sm">{error}</div>}
        <div className="flex gap-2 mt-2">
          <button type="submit" className="bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700" disabled={submitting}>
            {submitting ? 'Guardando...' : editId ? 'Actualizar' : 'Agregar'}
          </button>
          {editId && (
            <button type="button" onClick={handleCancel} className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400 transition">
              Cancelar
            </button>
          )}
        </div>
      </form>
      <h3 className="font-semibold mb-2">Tarjetas existentes</h3>
      {loading ? (
        <div className="text-gray-500">Cargando...</div>
      ) : cards.length === 0 ? (
        <div className="text-gray-400">No hay tarjetas aún.</div>
      ) : (
        <>
          <ul className="divide-y">
            {cards.slice((page-1)*CARDS_PER_PAGE, page*CARDS_PER_PAGE).map(card => (
              <li key={card.id} className="flex items-center justify-between py-2">
                <span>
                  <span className="font-bold text-blue-700">{card.en}</span> → <span className="text-gray-700">{card.es}</span>
                </span>
                <span className="flex gap-2">
                  <button
                    className="px-3 py-1 text-xs bg-blue-200 text-blue-900 rounded hover:bg-blue-300 border border-blue-400"
                    onClick={async () => {
                      setRegenerating(r => ({ ...r, [card.id]: true }));
                      try {
                        const res = await fetch(`${API_URL}/${card.id}/regenerate-audio`, {
                          method: 'POST',
                          headers: { Authorization: `Basic ${sessionStorage.getItem('admin_auth')}` },
                        });
                        if (!res.ok) throw new Error('Error regenerando audio');
                        const data = await res.json();
                        setCards(cards => cards.map(c => c.id === card.id ? { ...c, audio_url: data.audio_url } : c));
                      } catch (e) {
                        alert('Error regenerando audio');
                      } finally {
                        setRegenerating(r => ({ ...r, [card.id]: false }));
                      }
                    }}
                  > {regenerating[card.id] ? (
  <svg className="animate-spin h-4 w-4 inline-block mr-1 text-blue-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path></svg>
) : null}Regenerar audio</button>
                  <button
                    className="px-3 py-1 text-xs bg-yellow-400 rounded hover:bg-yellow-500"
                    onClick={() => handleEdit(card)}
                  >
                    Editar
                  </button>
                  <button
                    className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                    onClick={() => handleDelete(card.id)}
                  >
                    Eliminar
                  </button>
                  <button
                    className="px-3 py-1 text-xs bg-green-200 text-green-800 rounded hover:bg-green-300 border border-green-400"
                    onClick={async () => {
                      const now = new Date().toISOString();
                      await fetch(`${API_URL}/${card.id}`, {
                        method: 'PUT',
                        headers: {
                          Authorization: `Basic ${sessionStorage.getItem('admin_auth')}`,
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          en: card.en,
                          es: card.es,
                          level: card.level,
                          audio_url: card.audio_url,
                          nextReview: now
                        })
                      });
                      fetchDueCards();
                      fetchCards();
                    }}
                  >
                    Forzar repaso
                  </button>
                </span>
              </li>
            ))}
          </ul>
          {/* Paginador */}
          <div className="flex justify-center items-center gap-2 mt-4">
            <button
              className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Anterior
            </button>
            <span>Página {page} de {Math.ceil(cards.length / CARDS_PER_PAGE)}</span>
            <button
              className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
              onClick={() => setPage(p => Math.min(Math.ceil(cards.length / CARDS_PER_PAGE), p + 1))}
              disabled={page === Math.ceil(cards.length / CARDS_PER_PAGE) || cards.length === 0}
            >
              Siguiente
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default Admin;
