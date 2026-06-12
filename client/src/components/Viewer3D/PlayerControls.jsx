import { useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { Vector3, Euler } from 'three'

const MOVE_SPEED = 4      // meters per second
const LOOK_SENSITIVITY = 0.002

/**
 * First-person WASD + pointer-lock mouse controls.
 * Click the canvas to engage; Escape to release.
 */
export default function PlayerControls() {
  const { camera, gl } = useThree()

  const keys = useRef({})
  const yaw = useRef(0)    // left/right rotation (Y axis)
  const pitch = useRef(0)  // up/down rotation (X axis)
  const locked = useRef(false)

  // --- Pointer lock ---
  useEffect(() => {
    const canvas = gl.domElement

    function onClick() {
      if (!locked.current) canvas.requestPointerLock()
    }

    function onPointerLockChange() {
      locked.current = document.pointerLockElement === canvas
    }

    function onMouseMove(e) {
      if (!locked.current) return
      yaw.current -= e.movementX * LOOK_SENSITIVITY
      pitch.current -= e.movementY * LOOK_SENSITIVITY
      // Clamp pitch so you can't flip upside down
      pitch.current = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch.current))
    }

    canvas.addEventListener('click', onClick)
    document.addEventListener('pointerlockchange', onPointerLockChange)
    document.addEventListener('mousemove', onMouseMove)

    return () => {
      canvas.removeEventListener('click', onClick)
      document.removeEventListener('pointerlockchange', onPointerLockChange)
      document.removeEventListener('mousemove', onMouseMove)
    }
  }, [gl])

  // --- Keyboard ---
  useEffect(() => {
    function onKeyDown(e) { keys.current[e.code] = true }
    function onKeyUp(e)   { keys.current[e.code] = false }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  // --- Per-frame movement ---
  useFrame((_, delta) => {
    // Apply camera rotation
    camera.rotation.order = 'YXZ'
    camera.rotation.y = yaw.current
    camera.rotation.x = pitch.current

    // Build movement vector in camera's local XZ plane
    const move = new Vector3()
    if (keys.current['KeyW'] || keys.current['ArrowUp'])    move.z -= 1
    if (keys.current['KeyS'] || keys.current['ArrowDown'])  move.z += 1
    if (keys.current['KeyA'] || keys.current['ArrowLeft'])  move.x -= 1
    if (keys.current['KeyD'] || keys.current['ArrowRight']) move.x += 1

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(MOVE_SPEED * delta)
      // Rotate movement vector by camera's Y rotation so forward = where you're looking
      move.applyEuler(new Euler(0, yaw.current, 0))
      camera.position.add(move)
      // Lock Y to eye height (no flying)
      camera.position.y = 1.6
    }
  })

  return null
}
