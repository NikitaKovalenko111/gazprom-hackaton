import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import type { UserInput, Region } from '../../api/api'

type Props = {
  input?: UserInput
  region?: Region
  className?: string
  style?: React.CSSProperties
}

function createFallbackTexture(color = '#999999') {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = color
    ctx.fillRect(0, 0, 1, 1)
  }
  return new THREE.CanvasTexture(canvas)
}

function loadTextureSafe(url: string) {
  return new Promise<THREE.Texture>((resolve) => {
    const loader = new THREE.TextureLoader()
    loader.load(
      url,
      (tex) => resolve(tex),
      undefined,
      () => resolve(createFallbackTexture()),
    )
  })
}

const ThreeViewer: React.FC<Props> = ({ input, region, className, style }) => {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xececec)
    scene.fog = new THREE.Fog(0xececec, 80, 400)

    const w = container.clientWidth || 800
    const h = Math.max(300, Math.floor((w * 3) / 4))

    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 2000)
    camera.position.set(60, 40, 60)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(w, h)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    ;(renderer as any).physicallyCorrectLights = true

    const canvas = renderer.domElement
    canvas.style.touchAction = 'none'
    canvas.tabIndex = -1
    canvas.style.display = 'block'

    container.appendChild(canvas)

    const controls = new OrbitControls(camera, canvas)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    ;(controls as any).screenSpacePanning = false
    controls.minDistance = 5
    controls.maxDistance = 800

    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6)
    hemi.position.set(0, 200, 0)
    scene.add(hemi)

    const sun = new THREE.DirectionalLight(0xffffff, 0.9)
    sun.position.set(80, 120, 60)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    const s = 200
    sun.shadow.camera.left = -s
    sun.shadow.camera.right = s
    sun.shadow.camera.top = s
    sun.shadow.camera.bottom = -s
    sun.shadow.camera.near = 0.5
    sun.shadow.camera.far = 800
    scene.add(sun)

    let mounted = true

    ;(async () => {
      if (!mounted) return

      // Load textures (local preferred) with safe fallbacks
      const [groundTex, buildingTex, roofTex, roadTex, parkingTex] = await Promise.all([
        loadTextureSafe('/assets/ground-fallback.png'),
        loadTextureSafe('/assets/building-fallback.png'),
        loadTextureSafe('/assets/roof-fallback.png'),
        loadTextureSafe('/assets/road-fallback.png'),
        loadTextureSafe('/assets/parking-fallback.png'),
      ])

      groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping
      groundTex.repeat.set(80, 80)

      roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping
      roadTex.repeat.set(10, 1)

      parkingTex.wrapS = parkingTex.wrapT = THREE.RepeatWrapping
      parkingTex.repeat.set(6, 6)

      buildingTex.wrapS = buildingTex.wrapT = THREE.RepeatWrapping
      buildingTex.repeat.set(1, 1)

      roofTex.wrapS = roofTex.wrapT = THREE.RepeatWrapping
      roofTex.repeat.set(1, 1)

      // Ground
      const groundGeo = new THREE.PlaneGeometry(1200, 1200)
      const groundMat = new THREE.MeshStandardMaterial({ map: groundTex })
      const ground = new THREE.Mesh(groundGeo, groundMat)
      ground.rotation.x = -Math.PI / 2
      ground.receiveShadow = true
      scene.add(ground)

      // Determine scale from input.productionVolume (m2) to size factory
      const productionVolume = (input && typeof input.productionVolume === 'number') ? input.productionVolume : 20000
      const factoryBase = Math.max(800, productionVolume)
      const factoryW = Math.max(20, Math.sqrt(factoryBase) / 2)
      const factoryD = Math.max(12, factoryW * 0.8)
      const factoryH = Math.max(10, factoryW / 3)

      // Road: main horizontal axis
      const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, color: 0x333333 })
      const road = new THREE.Mesh(new THREE.BoxGeometry(800, 0.5, 24), roadMat)
      road.position.set(0, 0.25, 0)
      road.receiveShadow = true
      scene.add(road)

      // Secondary road vertical
      const road2 = new THREE.Mesh(new THREE.BoxGeometry(24, 0.5, 400), roadMat)
      road2.position.set(0, 0.25, -80)
      road2.receiveShadow = true
      scene.add(road2)

      // Parking lot near factory
      const parkingMat = new THREE.MeshStandardMaterial({ map: parkingTex, color: 0x444444 })
      const parking = new THREE.Mesh(new THREE.BoxGeometry(factoryW * 2.5, 0.2, factoryD * 1.2), parkingMat)
      parking.position.set(-factoryW * 0.8, 0.1, factoryD * 0.9)
      parking.receiveShadow = true
      scene.add(parking)

      // Factory building (textured)
      const facGeo = new THREE.BoxGeometry(factoryW, factoryH, factoryD)
      const facMat = new THREE.MeshStandardMaterial({ map: buildingTex, metalness: 0.2, roughness: 0.7 })
      const factory = new THREE.Mesh(facGeo, facMat)
      factory.position.set(-factoryW * 1.2, factoryH / 2, 20)
      factory.castShadow = true
      factory.receiveShadow = true
      scene.add(factory)

      // Factory roof highlight
      const roofGeo = new THREE.PlaneGeometry(factoryW * 0.98, factoryD * 0.98)
      const roofMat = new THREE.MeshStandardMaterial({ map: roofTex })
      const roof = new THREE.Mesh(roofGeo, roofMat)
      roof.rotation.x = -Math.PI / 2
      roof.position.set(factory.position.x, factoryH + 0.01, factory.position.z)
      roof.receiveShadow = false
      scene.add(roof)

      // Housing cluster (deterministic grid) on the east side
      const housingCount = Math.max(2, Math.round(((input && input.housingPercent) || 30) / 100 * 6))
      const housingSpacing = 18
      const houseW = 10
      const houseH = 8
      const houseMat = new THREE.MeshStandardMaterial({ map: buildingTex, color: 0xd9d9d9 })
      for (let row = 0; row < 2; row++) {
        for (let i = 0; i < Math.ceil(housingCount / 2); i++) {
          const hx = 40 + i * housingSpacing
          const hz = -40 + row * (housingSpacing + 4)
          const hGeo = new THREE.BoxGeometry(houseW, houseH, houseW * 0.6)
          const hMesh = new THREE.Mesh(hGeo, houseMat)
          hMesh.position.set(hx, houseH / 2, hz)
          hMesh.castShadow = true
          hMesh.receiveShadow = true
          scene.add(hMesh)
        }
      }

      // Small industrial annexes / warehouses near factory
      const annexMat = new THREE.MeshStandardMaterial({ color: 0x777777 })
      for (let i = 0; i < 3; i++) {
        const aw = Math.max(8, factoryW / 3)
        const ad = Math.max(10, factoryD / 2)
        const ah = Math.max(6, aw / 2)
        const ax = factory.position.x + (i - 1) * (aw + 6)
        const az = factory.position.z - factoryD - 12
        const aGeo = new THREE.BoxGeometry(aw, ah, ad)
        const aMesh = new THREE.Mesh(aGeo, annexMat)
        aMesh.position.set(ax, ah / 2, az)
        aMesh.castShadow = true
        aMesh.receiveShadow = true
        scene.add(aMesh)
      }

      // Trees: planted along the main road at regular intervals
      const treeTrunkMat = new THREE.MeshStandardMaterial({ color: 0x6b3e1a })
      const foliageMat = new THREE.MeshStandardMaterial({ color: 0x2e8b57 })
      for (let t = -300; t <= 300; t += 40) {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 3), treeTrunkMat)
        trunk.position.set(t, 1.5, -30)
        trunk.castShadow = true
        scene.add(trunk)
        const foliage = new THREE.Mesh(new THREE.SphereGeometry(2.5, 8, 6), foliageMat)
        foliage.position.set(t, 4, -30)
        foliage.castShadow = true
        scene.add(foliage)
      }

      // Grid helper for orientation
      const grid = new THREE.GridHelper(600, 60, 0x444444, 0xaaaaaa)
      scene.add(grid)
    })()

    let rafId = 0
    const tick = () => {
      rafId = requestAnimationFrame(tick)
      controls.update()
      renderer.render(scene, camera)
    }
    tick()

    const handleResize = () => {
      const ww = container.clientWidth || 800
      const hh = Math.max(300, Math.floor((ww * 3) / 4))
      camera.aspect = ww / hh
      camera.updateProjectionMatrix()
      renderer.setSize(ww, hh)
    }
    const ro = new ResizeObserver(handleResize)
    ro.observe(container)

    return () => {
      mounted = false
      ro.disconnect()
      cancelAnimationFrame(rafId)
      controls.dispose()
      try {
        scene.traverse((obj) => {
          const mesh = obj as THREE.Mesh
          if (mesh.isMesh) {
            mesh.geometry && mesh.geometry.dispose()
            if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose())
            else mesh.material && (mesh.material as THREE.Material).dispose()
          }
        })
      } catch (e) {}
      renderer.dispose()
      if (container.contains(canvas)) container.removeChild(canvas)
    }
  }, [input, region])

  return <div ref={containerRef} className={className} style={{ width: '100%', height: 560, overflow: 'hidden', borderRadius: 12, ...style }} />
}

export default ThreeViewer
