import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { studyApi, flashcardApi } from '../services/api';
import TipsDisplay from '../components/TipsDisplay.jsx';


function spacedRepetition(card) {
  if (!card.nextReview) return true;
  return new Date(card.nextReview) <= new Date();
}

function getNextInterval(level) {
  const intervals = [1, 10, 60, 1440, 4320, 10080];
  return intervals[Math.min(level, intervals.length - 1)] * 60 * 1000;
}

function Home() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [cards, setCards] = useState([]);
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const audioRef = React.useRef(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    const loadCards = async () => {
      try {
        setLoading(true);
        const dueCards = await studyApi.getMyDueCards();
        setCards(dueCards.cards || []);
      } catch (error) {
        console.error('Failed to load cards:', error);
        setCards([]);
      } finally {
        setLoading(false);
      }
    };
    
    loadCards();
  }, [isAuthenticated]);

  const handleFlip = () => setFlipped(f => !f);

  const handleAnswer = async (knewIt) => {
    const card = cards[current];
    const performanceRating = knewIt ? 4 : 1; // Good vs Again
    
    try {
      await studyApi.reviewCard(card.id, { performanceRating });
      
      const newCards = cards.filter((_, i) => i !== current);
      setCards(newCards);
      setFlipped(false);
      setCurrent(0);
      
      if (newCards.length === 0) {
        setLoading(true);
        const dueCards = await studyApi.getMyDueCards();
        setCards(dueCards.cards || []);
        setLoading(false);
      }
    } catch (error) {
      console.error('Failed to review card:', error);
    }
  };

  const playAudio = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
      setPlaying(true);
    }
  };

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;
  if (cards.length === 0) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="text-4xl mb-4">🎉</div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">All caught up!</h2>
        <p className="text-gray-600">No cards are due for review right now. Great job!</p>
      </div>
    </div>
  );

  const card = cards[current];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
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
              {card.english || card.en}
            </span>
          </div>
          {/* Back */}
          <div className="absolute w-full h-full bg-blue-100 rounded-lg shadow-lg flex flex-col items-center justify-center cursor-pointer rotate-y-180 backface-hidden px-6 py-4 overflow-auto">
            <span className="block text-xl sm:text-2xl font-bold text-center break-words whitespace-pre-line leading-snug mb-2">
              {card.spanish || card.es}
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
      </div>
    </div>
  );
}

export default Home;
