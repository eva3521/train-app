import { useEffect, useState } from 'react'

const COLORS = ['#7b6cff', '#c9a96e', '#4ecdc4', '#ff6b6b', '#e8e6f0']

function randomBetween(a, b) {
  return a + Math.random() * (b - a)
}

export default function Confetti({ active }) {
  const [particles, setParticles] = useState([])

  useEffect(() => {
    if (!active) return
    const ps = Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: randomBetween(10, 90),
      delay: randomBetween(0, 0.5),
      duration: randomBetween(1.5, 3),
      color: COLORS[i % COLORS.length],
      size: randomBetween(4, 8),
      rotation: randomBetween(0, 360),
    }))
    setParticles(ps)
    const t = setTimeout(() => setParticles([]), 3500)
    return () => clearTimeout(t)
  }, [active])

  if (particles.length === 0) return null

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 100, overflow: 'hidden' }}>
      {particles.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: '-10px',
            width: p.size,
            height: p.size * 1.4,
            background: p.color,
            borderRadius: '1px',
            transform: `rotate(${p.rotation}deg)`,
            animation: `confettiFall ${p.duration}s ${p.delay}s ease-in forwards`,
          }}
        />
      ))}
      <style>{`
        @keyframes confettiFall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
