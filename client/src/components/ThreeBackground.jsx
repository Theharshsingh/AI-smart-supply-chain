import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial } from '@react-three/drei';
import { Suspense } from 'react';

function ParticleField({ count = 80 }) {
  const mesh = useRef();
  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < count; i++) {
      temp.push({
        pos: [(Math.random() - 0.5) * 18, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 10 - 5],
        speed: 0.1 + Math.random() * 0.3,
        size: 0.02 + Math.random() * 0.04,
        color: ['#3b82f6', '#6366f1', '#10b981', '#8b5cf6'][Math.floor(Math.random() * 4)],
      });
    }
    return temp;
  }, [count]);

  useFrame(({ clock }) => {
    if (mesh.current) {
      mesh.current.rotation.y = clock.getElapsedTime() * 0.015;
      mesh.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.01) * 0.1;
    }
  });

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particles.length}
          itemSize={3}
          array={new Float32Array(particles.flatMap(p => p.pos))}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        color="#3b82f6"
        transparent
        opacity={0.6}
        blending={2}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

function GlowingOrb() {
  const mesh = useRef();
  useFrame(({ clock }) => {
    if (mesh.current) {
      mesh.current.position.x = Math.sin(clock.getElapsedTime() * 0.2) * 2;
      mesh.current.position.y = Math.cos(clock.getElapsedTime() * 0.15) * 1.5;
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
      <mesh ref={mesh} position={[0, 0, -3]}>
        <sphereGeometry args={[0.6, 32, 32]} />
        <MeshDistortMaterial
          color="#3b82f6"
          emissive="#3b82f6"
          emissiveIntensity={0.4}
          transparent
          opacity={0.3}
          distort={0.3}
          speed={2}
          roughness={0.1}
          metalness={0.8}
        />
      </mesh>
    </Float>
  );
}

function ConnectionLines() {
  const mesh = useRef();
  const positions = useMemo(() => {
    const pts = [];
    const cities = [
      [-2, 1.5, -2], [2.5, -1, -1.5], [-1.5, -2.5, -1],
      [3, 2, -2.5], [-3, 0.5, -1], [0.5, 3, -2],
    ];
    for (let i = 0; i < cities.length; i++) {
      for (let j = i + 1; j < cities.length; j++) {
        pts.push(...cities[i]);
        pts.push(...cities[j]);
      }
    }
    return new Float32Array(pts);
  }, []);

  useFrame(({ clock }) => {
    if (mesh.current) {
      mesh.current.material.opacity = 0.15 + Math.sin(clock.getElapsedTime() * 0.3) * 0.1;
    }
  });

  return (
    <lineSegments ref={mesh}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          itemSize={3}
          array={positions}
        />
      </bufferGeometry>
      <lineBasicMaterial color="#3b82f6" transparent opacity={0.15} />
    </lineSegments>
  );
}

export default function ThreeBackground() {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 0, pointerEvents: 'none', opacity: 0.5,
    }}>
      <Canvas
        camera={{ position: [0, 0, 6], fov: 60 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.3} />
        <pointLight position={[10, 10, 10]} intensity={0.5} />
        <Suspense fallback={null}>
          <ParticleField count={120} />
          <GlowingOrb />
          <ConnectionLines />
        </Suspense>
      </Canvas>
    </div>
  );
}