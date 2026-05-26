declare module 'three/examples/jsm/controls/OrbitControls' {
  import { Camera, EventDispatcher, MOUSE, TOUCH } from 'three'

  export class OrbitControls extends EventDispatcher {
    constructor(object: Camera, domElement?: HTMLElement)
    enabled: boolean
    target: import('three').Vector3
    update(): void
    dispose(): void
    enableZoom: boolean
    enableRotate: boolean
    enablePan: boolean
    enableDamping?: boolean
    dampingFactor?: number
    minDistance?: number
    maxDistance?: number
    maxPolarAngle?: number
    mouseButtons: Partial<Record<typeof MOUSE[keyof typeof MOUSE], string>>
    touches: Partial<Record<typeof TOUCH[keyof typeof TOUCH], string>>
  }
}
