import React, { useEffect, useState } from 'react';
import TipsDisplay from '../components/TipsDisplay.jsx';
import tokenStorage from '../utils/storageUtils.js';

const API_URL = '\/api/cards';

function spacedRepetition(card) {
  if (!card.nextReview) return true;
  return new Date(card.nextReview) <= new Date();
}

function getNextInterval(level) {
  const intervals = [1, 10, 60, 1440, 4320, 10080];
  return intervals[Math.min(level, intervals.length - 1)] * 60 * 1000;
}

function Home() {
  const [cards, setCards] = useState([]);
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const audioRef = React.useRef(null);

  useEffect(() => {
    // Check authentication status
    const authenticated = tokenStorage.isAuthenticated();
    setIsAuthenticated(authenticated);

    if (!authenticated) {
      setLoading(false);
      setError('Please log in to access your flashcards');
      return;
    }

    // Load cards with authentication
    const loadCards = async () => {
      try {
        const headers = {
          'Content-Type': 'application/json',
          ...tokenStorage.getAuthHeaders()
        };

        const response = await fetch('\/api/cards\/next', { headers });
        
        if (!response.ok) {
          if (response.status === 401) {
            setError('Session expired. Please log in again.');
            tokenStorage.clearAll();
            setIsAuthenticated(false);
            return;
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        setCards(data);
        setError(null);
      } catch (err) {
        console.error('Error loading cards:', err);
        setError('Failed to load cards. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadCards();
  }, []);

  const handleFlip = () => setFlipped(f => !f);

  const handleAnswer = async (knewIt) => {
    if (!isAuthenticated) {
      setError('Please log in to answer cards');
      return;
    }

    try {
      const card = cards[current];
      let level = card.level || 0;
      level = knewIt ? level + 1 : 0;
      const nextReview = new Date(Date.now() + getNextInterval(level)).toISOString();
      
      const headers = {
        'Content-Type': 'application/json',
        ...tokenStorage.getAuthHeaders()
      };

      const response = await fetch(`${API_URL}/${card.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ level, nextReview })
      });

      if (!response.ok) {
        if (response.status === 401) {
          setError('Session expired. Please log in again.');
          tokenStorage.clearAll();
          setIsAuthenticated(false);
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Update UI after successful answer
      const newCards = cards.filter((_, i) => i !== current);
      setCards(newCards);
      setFlipped(false);
      setCurrent(0);
      setError(null);

      // Load more cards if needed
      if (newCards.length === 0) {
        setLoading(true);
        try {
          const nextResponse = await fetch('\/api/cards\/next', { headers });
          
          if (!nextResponse.ok) {
            if (nextResponse.status === 401) {
              setError('Session expired. Please log in again.');
              tokenStorage.clearAll();
              setIsAuthenticated(false);
              return;
            }
            throw new Error(`HTTP ${nextResponse.status}: ${nextResponse.statusText}`);
          }

          const data = await nextResponse.json();
          setCards(data);
        } catch (err) {
          console.error('Error loading next cards:', err);
          setError('Failed to load more cards. Please refresh the page.');
        } finally {
          setLoading(false);
        }
      }
    } catch (err) {
      console.error('Error answering card:', err);
      setError('Failed to save answer. Please try again.');
    }
  };

  const playAudio = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
      setPlaying(true);
    }
  };

  // Handle loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64">
        <div className="text-gray-500">Cargando tarjetas...</div>
      </div>
    );
  }

  // Handle error states
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64">
        <div className="text-red-500 mb-4">{error}</div>
        {!isAuthenticated && (
          <div className="space-x-2">
            <button 
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
              onClick={() => window.location.href = '/login'}
            >
              Log In
            </button>
            <button 
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition"
              onClick={() => window.location.href = '/register'}
            >
              Sign Up
            </button>
          </div>
        )}
        {isAuthenticated && (
          <button 
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  // Handle no cards state
  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64">
        <div className="text-gray-500 mb-4">¡No hay tarjetas para repasar ahora!</div>
        <div className="text-sm text-gray-400">
          Vuelve más tarde o <a href="/admin" className="text-blue-500 hover:underline">crea más tarjetas</a>
        </div>
      </div>
    );
  }

  const card = cards[current];

  return (
    <div className="flex flex-col items-center">
      <h2 className="text-2xl font-semibold mb-4">Repaso de Tarjetas</h2>
      <div className="w-full max-w-2xl h-64 sm:h-80 perspective mb-6">
        <div
          className={`relative w-full h-full transition-transform duration-500 ${flipped ? 'rotate-y-180' : ''}`}
          style={{ transformStyle: 'preserve-3d' }}
          onClick={handleFlip}
        >
          {/* Front */}
          <div className="absolute w-full h-full bg-white rounded-lg shadow-lg flex items-center justify-center cursor-pointer backface-hidden px-6 py-4 overflow-auto">
            <span className="block text-xl sm:text-2xl font-bold text-center break-words whitespace-pre-line leading-snug">
              {card.en}
            </span>
          </div>
          {/* Back */}
          <div className="absolute w-full h-full bg-blue-100 rounded-lg shadow-lg flex flex-col items-center justify-center cursor-pointer rotate-y-180 backface-hidden px-6 py-4 overflow-auto">
            <span className="block text-xl sm:text-2xl font-bold text-center break-words whitespace-pre-line leading-snug mb-2">
              {card.es}
            </span>
            {/* Tips de Gemini */}
            {card.tips && <TipsDisplay tips={card.tips} />}
          </div>
        </div>
      </div>
      {card.audio_url && (
        <div className="mb-4 flex flex-col items-center">
          <button
            className="mb-2 px-4 py-2 bg-blue-500 text-white rounded shadow hover:bg-blue-600 transition"
            onClick={playAudio}
            type="button"
          >
            Escuchar inglés 🔊
          </button>
          <audio
            ref={audioRef}
            src={card.audio_url ? `/audio/${card.audio_url.replace(/^.*[\\\/]/, '')}` : ''}
            onEnded={() => setPlaying(false)}
            preload="auto"
          />
        </div>
      )}
      <div className="flex gap-4">
        <button
          className="px-6 py-2 bg-green-500 text-white rounded shadow hover:bg-green-600 transition"
          onClick={() => handleAnswer(true)}
        >
          Lo sé
        </button>
        <button
          className="px-6 py-2 bg-red-500 text-white rounded shadow hover:bg-red-600 transition"
          onClick={() => handleAnswer(false)}
        >
          No lo sé
        </button>
      </div>
      <div className="mt-4 text-gray-400 text-sm">Haz click en la tarjeta para ver la respuesta</div>
    </div>
  );
}

export default Home;
