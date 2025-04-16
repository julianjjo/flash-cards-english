import React, { useEffect, useState } from 'react';

const API_URL = 'http://localhost:4000/api/cards';

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
  const audioRef = React.useRef(null);

  useEffect(() => {
    fetch('http://localhost:4000/api/cards/next')
      .then(res => res.json())
      .then(data => {
        setCards(data);
        setLoading(false);
      });
  }, []);

  const handleFlip = () => setFlipped(f => !f);

  const handleAnswer = (knewIt) => {
    const card = cards[current];
    let level = card.level || 0;
    level = knewIt ? level + 1 : 0;
    const nextReview = new Date(Date.now() + getNextInterval(level)).toISOString();
    fetch(`${API_URL}/${card.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, nextReview })
    }).then(() => {
      const newCards = cards.filter((_, i) => i !== current);
      setCards(newCards);
      setFlipped(false);
      setCurrent(0);
      if (newCards.length === 0) {
        setLoading(true);
        fetch('http://localhost:4000/api/cards/next')
          .then(res => res.json())
          .then(data => {
            setCards(data);
            setLoading(false);
          });
      }
    });
  };

  const playAudio = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
      setPlaying(true);
    }
  };

  if (loading) return <div className="text-gray-500">Cargando tarjetas...</div>;
  if (cards.length === 0) return <div className="text-gray-500">¡No hay tarjetas para repasar ahora!</div>;

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
          <div className="absolute w-full h-full bg-blue-100 rounded-lg shadow-lg flex items-center justify-center cursor-pointer rotate-y-180 backface-hidden px-6 py-4 overflow-auto">
            <span className="block text-xl sm:text-2xl font-bold text-center break-words whitespace-pre-line leading-snug">
              {card.es}
            </span>
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
            src={`http://localhost:4000${card.audio_url}`}
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
