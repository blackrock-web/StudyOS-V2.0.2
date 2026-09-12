import React, { useEffect, useRef } from 'react';

interface VictoryCelebrationCanvasProps {
  active: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  vRot: number;
  type: 'confetti' | 'petal' | 'star';
  opacity: number;
}

export const VictoryCelebrationCanvas: React.FC<VictoryCelebrationCanvasProps> = ({ active }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const colors = [
      '#EC4899', '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B',
      '#EF4444', '#F472B6', '#A78BFA', '#60A5FA', '#34D399'
    ];

    const particles: Particle[] = [];
    const particleCount = 120;

    for (let i = 0; i < particleCount; i++) {
      const typeRand = Math.random();
      const type: 'confetti' | 'petal' | 'star' =
        typeRand < 0.4 ? 'confetti' : typeRand < 0.8 ? 'petal' : 'star';

      particles.push({
        x: Math.random() * width,
        y: Math.random() * height - height,
        vx: (Math.random() - 0.5) * 2,
        vy: Math.random() * 2 + 1.5,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)] || '#EC4899',
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.08,
        type,
        opacity: Math.random() * 0.4 + 0.6,
      });
    }

    const drawParticle = (p: Particle) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;

      if (p.type === 'confetti') {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else if (p.type === 'petal') {
        // Draw soft flower petal curve
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.bezierCurveTo(p.size / 2, -p.size / 2, p.size / 2, p.size / 2, 0, p.size);
        ctx.bezierCurveTo(-p.size / 2, p.size / 2, -p.size / 2, -p.size / 2, 0, -p.size);
        ctx.fill();
      } else {
        // Draw star / sparkle
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          ctx.lineTo(
            Math.cos(((18 + i * 72) * Math.PI) / 180) * p.size,
            -Math.sin(((18 + i * 72) * Math.PI) / 180) * p.size
          );
          ctx.lineTo(
            Math.cos(((54 + i * 72) * Math.PI) / 180) * (p.size / 2),
            -Math.sin(((54 + i * 72) * Math.PI) / 180) * (p.size / 2)
          );
        }
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.x += p.vx + Math.sin(p.y * 0.01) * 0.5; // gentle sway
        p.y += p.vy;
        p.rotation += p.vRot;

        if (p.y > height + 20) {
          p.y = -20;
          p.x = Math.random() * width;
        }

        drawParticle(p);
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[100000] w-full h-full"
    />
  );
};
