'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import Globe to avoid SSR issues (it uses WebGL/canvas)
const Globe = dynamic(() => import('react-globe.gl'), {
  ssr: false,
  loading: () => null,
});

interface GlobeBackgroundProps {
  /** opacity of the globe — animate between 0 and 1 from parent */
  opacity?: number;
  /** user coordinates — when supplied the globe stops spinning and flies here */
  coords?: { lat: number; lon: number } | null;
}

export function GlobeBackground({ opacity = 1, coords = null }: GlobeBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globeRef = useRef<any>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [isReady, setIsReady] = useState(false);
  const hasFlewToLocation = useRef(false);

  // Keep globe sized to the viewport
  useEffect(() => {
    const update = () =>
      setSize({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Start auto-rotation once the globe WebGL scene is ready
  useEffect(() => {
    if (!isReady || !globeRef.current) return;
    const controls = globeRef.current.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.2;
    controls.update();
  }, [isReady]);

  // When coordinates arrive: stop spinning, fly to location
  useEffect(() => {
    if (!isReady || !coords || hasFlewToLocation.current || !globeRef.current) return;
    hasFlewToLocation.current = true;

    // Stop auto-rotation
    const controls = globeRef.current.controls();
    controls.autoRotate = false;
    controls.update();

    // Smooth camera flight to user's location
    globeRef.current.pointOfView(
      { lat: coords.lat, lng: coords.lon, altitude: 0.8 },
      3200 // ms — longer sweep for the deeper zoom
    );
  }, [coords, isReady]);

  if (size.width === 0) return null;

  // Render canvas larger than the viewport so the globe fills the screen
  const SCALE = 2.2;
  const canvasW = size.width * SCALE;
  const canvasH = size.height * SCALE;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        opacity,
        transition: 'opacity 1.2s ease',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Globe
        ref={globeRef}
        width={canvasW}
        height={canvasH}
        backgroundColor="rgba(0,0,0,0)"
        atmosphereColor="#7dd3fc"
        atmosphereAltitude={0.22}
        // Blue marble with cloud coverage
        globeImageUrl="//cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg"
        bumpImageUrl="//cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png"
        // No pointer interaction — background only
        enablePointerInteraction={false}
        onGlobeReady={() => setIsReady(true)}
        // No arcs, labels, or extra overlays
        arcsData={[]}
        labelsData={[]}
        pointsData={[]}
      />
    </div>
  );
}
