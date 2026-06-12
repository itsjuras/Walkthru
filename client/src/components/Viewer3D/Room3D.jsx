import { useLoader } from '@react-three/fiber'
import { TextureLoader } from 'three'
import { useMemo } from 'react'

const FALLBACK_COLORS = {
  north:   '#1a1a2e',
  south:   '#16213e',
  east:    '#0f3460',
  west:    '#533483',
  floor:   '#2d2d2d',
  ceiling: '#1a1a1a',
}

function TexturedWall({ url, position, rotation, width, height }) {
  const texture = useLoader(TextureLoader, url)
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  )
}

function FlatWall({ color, position, rotation, width, height }) {
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}

export default function Room3D({ room }) {
  const { position, size, walls } = room
  const { w, h, d } = size
  const { x, y, z } = position

  const wallDefs = useMemo(() => [
    { dir: 'north',   pos: [x,         y + h / 2, z - d / 2], rot: [0, 0, 0],              pw: w, ph: h },
    { dir: 'south',   pos: [x,         y + h / 2, z + d / 2], rot: [0, Math.PI, 0],         pw: w, ph: h },
    { dir: 'east',    pos: [x + w / 2, y + h / 2, z],         rot: [0, -Math.PI / 2, 0],    pw: d, ph: h },
    { dir: 'west',    pos: [x - w / 2, y + h / 2, z],         rot: [0,  Math.PI / 2, 0],    pw: d, ph: h },
    { dir: 'floor',   pos: [x, y,     z],                     rot: [-Math.PI / 2, 0, 0],    pw: w, ph: d },
    { dir: 'ceiling', pos: [x, y + h, z],                     rot: [ Math.PI / 2, 0, 0],    pw: w, ph: d },
  ], [x, y, z, w, h, d])

  return (
    <group>
      {wallDefs.map(({ dir, pos, rot, pw, ph }) =>
        walls[dir]
          ? <TexturedWall key={dir} url={walls[dir]} position={pos} rotation={rot} width={pw} height={ph} />
          : <FlatWall     key={dir} color={FALLBACK_COLORS[dir]} position={pos} rotation={rot} width={pw} height={ph} />
      )}
    </group>
  )
}
