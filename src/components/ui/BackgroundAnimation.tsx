import { useEffect, useState } from 'react';
import { Stage, Layer, Circle } from 'react-konva';

export default function BackgroundAnimation() {
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [particles, setParticles] = useState<any[]>([]);

  useEffect(() => {
    const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    
    // Generate static particles array
    const newParticles = Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      radius: Math.random() * 300 + 50,
      opacity: Math.random() * 0.05 + 0.01,
      color: i % 2 === 0 ? '#10b981' : '#0ea5e9' // Emerald or Sky
    }));
    setParticles(newParticles);
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-0 mix-blend-screen opacity-60">
      <Stage width={dimensions.width} height={dimensions.height}>
        <Layer>
          {particles.map((p) => (
            <Circle
              key={p.id}
              x={p.x}
              y={p.y}
              radius={p.radius}
              fill={p.color}
              opacity={p.opacity}
              filters={[]}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}
