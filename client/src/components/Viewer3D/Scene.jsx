import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import { isMobile } from '../../utils/device'
import Room3D from './Room3D'
import PlayerControls from './PlayerControls'
import MobileControls from './MobileControls'

/**
 * sceneData shape:
 * {
 *   rooms: [{
 *     id, name,
 *     position: { x, y, z },
 *     size: { w, h, d },         // width, height (ceiling), depth — in meters
 *     walls: { north, south, east, west, floor, ceiling } // photo URLs
 *   }],
 *   startPosition: { x, y, z },  // eye-level start (y ~1.6)
 * }
 */
export default function Scene({ sceneData }) {
  const mobile = isMobile()

  return (
    <>
      <Canvas
        camera={{
          fov: 75,
          near: 0.05,
          far: 100,
          position: [
            sceneData.startPosition?.x ?? 0,
            sceneData.startPosition?.y ?? 1.6,
            sceneData.startPosition?.z ?? 0,
          ],
        }}
        shadows
        gl={{ antialias: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <Suspense fallback={null}>
          {/* Ambient light so untextured walls aren't pitch black */}
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 8, 5]} intensity={0.4} />

          {/* Render all rooms */}
          {sceneData.rooms.map(room => (
            <Room3D key={room.id} room={room} />
          ))}

          {/* Controls — desktop only (mobile uses overlay joystick) */}
          {!mobile && <PlayerControls />}
        </Suspense>
      </Canvas>

      {/* Mobile overlay controls rendered outside Canvas */}
      {mobile && <MobileControls />}
    </>
  )
}
