/* ── GameScene — main Three.js canvas with isometric camera ── */
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import Building3D from './Building3D'
import Agents3D from './Agents3D'
import Paths3D from './Paths3D'
import WaypointPicker from './WaypointPicker'
import BayesianOverlay3D from './BayesianOverlay3D'
import { useGameStore } from '../store/gameStore'

export default function GameScene() {
  const building = useGameStore((s) => s.building)

  const cx = building ? building.width / 2 : 10
  const cz = building ? building.height / 2 : 10

  return (
    <Canvas
      camera={{
        position: [cx + 18, 22, cz + 18],
        fov: 35,
        near: 0.1,
        far: 200,
      }}
      style={{ width: '100%', height: '100%' }}
      gl={{ antialias: true }}
    >
      {/* Lighting — dark cyberpunk */}
      <ambientLight intensity={0.15} color="#4a4a6a" />
      <directionalLight position={[20, 30, 10]} intensity={0.4} color="#8888cc" />
      <pointLight position={[cx, 10, cz]} intensity={0.3} color="#00d4ff" distance={40} />

      {/* Fog */}
      <fog attach="fog" args={['#0a0a1a', 30, 60]} />

      {/* Scene */}
      <Building3D />
      <Agents3D />
      <Paths3D />
      <WaypointPicker />
      <BayesianOverlay3D />

      {/* Camera controls */}
      <OrbitControls
        target={[cx, 0, cz]}
        maxPolarAngle={Math.PI / 2.5}
        minPolarAngle={Math.PI / 6}
        minDistance={8}
        maxDistance={50}
        enablePan
      />
    </Canvas>
  )
}
