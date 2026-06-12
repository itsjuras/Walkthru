import { useEffect, useRef, useState } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { Vector3, Euler } from 'three'

const MOVE_SPEED = 3
const LOOK_SENSITIVITY = 0.005
const JOYSTICK_RADIUS = 50  // px

/**
 * Mobile first-person controls:
 *  - Left half:  virtual joystick for movement
 *  - Right half: drag anywhere to look
 */
export default function MobileControls() {
  // Joystick state
  const [joystick, setJoystick] = useState({ active: false, originX: 0, originY: 0, dx: 0, dy: 0 })
  const joystickRef = useRef({ dx: 0, dy: 0 })

  // Look state
  const lookRef = useRef({ lastX: 0, lastY: 0, active: false })
  const yaw = useRef(0)
  const pitch = useRef(0)

  const { camera, size } = useThree()

  // --- Touch handlers ---
  useEffect(() => {
    const joystickTouches = new Map()
    const lookTouches = new Map()

    function isLeftSide(x) { return x < size.width / 2 }

    function onTouchStart(e) {
      for (const touch of e.changedTouches) {
        if (isLeftSide(touch.clientX)) {
          joystickTouches.set(touch.identifier, touch)
          setJoystick({ active: true, originX: touch.clientX, originY: touch.clientY, dx: 0, dy: 0 })
        } else {
          lookTouches.set(touch.identifier, touch)
          lookRef.current = { lastX: touch.clientX, lastY: touch.clientY, active: true }
        }
      }
    }

    function onTouchMove(e) {
      for (const touch of e.changedTouches) {
        if (joystickTouches.has(touch.identifier)) {
          const origin = joystickTouches.get(touch.identifier)
          let dx = touch.clientX - origin.clientX
          let dy = touch.clientY - origin.clientY
          const len = Math.sqrt(dx * dx + dy * dy)
          if (len > JOYSTICK_RADIUS) {
            dx = (dx / len) * JOYSTICK_RADIUS
            dy = (dy / len) * JOYSTICK_RADIUS
          }
          joystickRef.current = { dx, dy }
          setJoystick(j => ({ ...j, dx, dy }))
        }

        if (lookTouches.has(touch.identifier) && lookRef.current.active) {
          const dx = touch.clientX - lookRef.current.lastX
          const dy = touch.clientY - lookRef.current.lastY
          yaw.current -= dx * LOOK_SENSITIVITY
          pitch.current -= dy * LOOK_SENSITIVITY
          pitch.current = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch.current))
          lookRef.current.lastX = touch.clientX
          lookRef.current.lastY = touch.clientY
        }
      }
    }

    function onTouchEnd(e) {
      for (const touch of e.changedTouches) {
        if (joystickTouches.has(touch.identifier)) {
          joystickTouches.delete(touch.identifier)
          joystickRef.current = { dx: 0, dy: 0 }
          setJoystick({ active: false, originX: 0, originY: 0, dx: 0, dy: 0 })
        }
        if (lookTouches.has(touch.identifier)) {
          lookTouches.delete(touch.identifier)
          lookRef.current.active = false
        }
      }
    }

    window.addEventListener('touchstart', onTouchStart, { passive: false })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd)

    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [size.width])

  // --- Per-frame update ---
  useFrame((_, delta) => {
    camera.rotation.order = 'YXZ'
    camera.rotation.y = yaw.current
    camera.rotation.x = pitch.current

    const { dx, dy } = joystickRef.current
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      const move = new Vector3(
        dx / JOYSTICK_RADIUS,
        0,
        dy / JOYSTICK_RADIUS
      ).multiplyScalar(MOVE_SPEED * delta)
      move.applyEuler(new Euler(0, yaw.current, 0))
      camera.position.add(move)
      camera.position.y = 1.6
    }
  })

  // --- Joystick UI overlay ---
  if (!joystick.active) return null

  const thumbX = joystick.originX + joystick.dx
  const thumbY = joystick.originY + joystick.dy

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
      {/* Outer ring */}
      <div
        className="absolute rounded-full border-2 border-white/30 bg-white/10"
        style={{
          width: JOYSTICK_RADIUS * 2,
          height: JOYSTICK_RADIUS * 2,
          left: joystick.originX - JOYSTICK_RADIUS,
          top: joystick.originY - JOYSTICK_RADIUS,
        }}
      />
      {/* Thumb */}
      <div
        className="absolute rounded-full bg-white/50"
        style={{
          width: 40, height: 40,
          left: thumbX - 20,
          top: thumbY - 20,
        }}
      />
    </div>
  )
}
