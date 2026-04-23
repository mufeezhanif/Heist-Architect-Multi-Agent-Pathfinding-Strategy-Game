/* ── GameScene — main Three.js canvas with isometric camera ── */
import { Component, ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import Building3D from './Building3D'
import Agents3D from './Agents3D'
import Paths3D from './Paths3D'
import WaypointPicker from './WaypointPicker'
import BayesianOverlay3D from './BayesianOverlay3D'
import { useGameStore } from '../store/gameStore'

class CanvasErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050508', color: '#00f0ff', fontSize: 18 }}>
          3D scene failed to load. Try refreshing.
        </div>
      )
    }
    return this.props.children
  }
}

export default function GameScene() {
  const building = useGameStore((s) => s.building)

  const cx = building ? building.width / 2 : 10
  const cz = building ? building.height / 2 : 10

  return (
  <CanvasErrorBoundary>
    <Canvas
      camera={{
        position: [cx + 18, 22, cz + 18],
        fov: 35,
        near: 0.1,
        far: 200,
      }}
      style={{ width: '100%', height: '100%' }}
      gl={{ antialias: false }} // Turn off antialias for postprocessing performance
    >
      {/* Lighting — dark cyberpunk */}
      <ambientLight intensity={0.2} color="#2a2a4a" />
      <directionalLight position={[20, 30, 10]} intensity={0.6} color="#444488" />
      <pointLight position={[cx, 15, cz]} intensity={0.8} color="#00f0ff" distance={50} />

      {/* Fog */}
      <fog attach="fog" args={['#050508', 30, 65]} />

      {/* Scene */}
      <Building3D />
      <Agents3D />
      <Paths3D />
      <WaypointPicker />
      <BayesianOverlay3D />

      {/* Camera controls */}
      <OrbitControls
        target={[cx, 0, cz]}
        maxPolarAngle={Math.PI / 2.2}
        minPolarAngle={Math.PI / 8}
        minDistance={10}
        maxDistance={60}
        enablePan
      />
    </Canvas>
  </CanvasErrorBoundary>
  )
}
