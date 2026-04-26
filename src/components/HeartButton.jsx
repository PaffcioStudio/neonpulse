import React, { useState, useCallback, useRef } from 'react';

// Cząsteczki dla animacji
function Particle({ x, y, color, angle, distance }) {
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: x, top: y,
        width: 6, height: 6,
        borderRadius: '50%',
        background: color,
        transform: `translate(-50%, -50%)`,
        animation: `heartParticle 0.6s ease-out forwards`,
        '--angle': `${angle}deg`,
        '--dist': `${distance}px`,
      }}
    />
  );
}

export default function HeartButton({ isFavorite, onToggle, size = 17, className = '' }) {
  const [animState, setAnimState] = useState(null); // 'adding' | 'removing' | null
  const [particles, setParticles] = useState([]);
  const [showBreak, setShowBreak] = useState(false);
  const timeoutRef = useRef(null);

  const handleClick = useCallback((e) => {
    e.stopPropagation();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (!isFavorite) {
      // Dodawanie do ulubionych – serce pulsuje i wybucha
      setAnimState('adding');
      setShowBreak(false);
      // Generuj cząsteczki
      const cols = ['#ef4444', '#f97316', '#ec4899', '#f43f5e', '#fbbf24', '#ff6b9d'];
      setParticles(Array.from({ length: 8 }, (_, i) => ({
        id: i,
        angle: (360 / 8) * i,
        distance: 18 + Math.random() * 12,
        color: cols[i % cols.length],
      })));
      timeoutRef.current = setTimeout(() => {
        setAnimState(null);
        setParticles([]);
      }, 700);
    } else {
      // Usuwanie z ulubionych – pękające serce
      setAnimState('removing');
      setShowBreak(true);
      timeoutRef.current = setTimeout(() => {
        setAnimState(null);
        setShowBreak(false);
        setParticles([]);
      }, 600);
    }

    onToggle();
  }, [isFavorite, onToggle]);

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size + 16, height: size + 16 }}>
      {/* Cząsteczki przy dodawaniu */}
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute pointer-events-none"
          style={{
            width: 5, height: 5,
            borderRadius: '50%',
            background: p.color,
            left: '50%', top: '50%',
            transform: 'translate(-50%, -50%)',
            animation: `heartParticle 0.65s ease-out forwards`,
            animationDelay: `${p.id * 20}ms`,
            '--px': `${Math.cos((p.angle * Math.PI) / 180) * p.distance}px`,
            '--py': `${Math.sin((p.angle * Math.PI) / 180) * p.distance}px`,
          }}
        />
      ))}

      {/* Pierścień przy dodawaniu */}
      {animState === 'adding' && (
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            border: '2px solid #ef4444',
            animation: 'heartRing 0.5s ease-out forwards',
          }}
        />
      )}

      {/* Serce – normalne lub pękające */}
      <button
        onClick={handleClick}
        className="relative z-10 transition-transform hover:scale-110 active:scale-95"
        style={{
          animation: animState === 'adding'
            ? 'heartAdd 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) forwards'
            : animState === 'removing'
            ? 'heartRemove 0.5s ease-in-out forwards'
            : 'none',
        }}
      >
        {isFavorite && showBreak ? (
          // Pęknięte serce SVG
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <path d="M12 21C12 21 3 13.5 3 8a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 1.5-.5 3-1.5 4.5" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M12 21L9 14l3-3 3 3-3 7z" fill="#ef4444" opacity="0.6"/>
            <path d="M11 8l1 6" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" opacity="0.8"/>
            <path d="M9 10l4 2" stroke="#ef4444" strokeWidth="1" strokeLinecap="round" opacity="0.6"/>
          </svg>
        ) : (
          <svg width={size} height={size} viewBox="0 0 24 24" fill={isFavorite ? '#ef4444' : 'none'} stroke={isFavorite ? '#ef4444' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        )}
      </button>

      <style>{`
        @keyframes heartAdd {
          0%   { transform: scale(1); }
          30%  { transform: scale(1.5); }
          60%  { transform: scale(0.85); }
          80%  { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        @keyframes heartRemove {
          0%   { transform: scale(1) rotate(0deg); }
          20%  { transform: scale(1.1) rotate(-5deg); }
          40%  { transform: scale(0.9) rotate(5deg); }
          60%  { transform: scale(0.95) rotate(-3deg); }
          80%  { transform: scale(0.85) rotate(2deg); }
          100% { transform: scale(0.7) rotate(0deg); opacity: 0.5; }
        }
        @keyframes heartParticle {
          0%   { transform: translate(-50%, -50%) translate(0, 0); opacity: 1; }
          100% { transform: translate(-50%, -50%) translate(var(--px), var(--py)); opacity: 0; }
        }
        @keyframes heartRing {
          0%   { transform: scale(0.5); opacity: 0.8; }
          100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
