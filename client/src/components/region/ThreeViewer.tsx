import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import type { UserInput, Region } from '../../api/api'

import grassTexure from './../../assets/textures/grass_texture.jpg'
import buildingTexture from './../../assets/textures/building_texture.jpg'
import facadeTexture from './../../assets/textures/facade_texture.jpg'

type Props = {
  input?: UserInput
  region?: Region
  className?: string
  style?: React.CSSProperties
}

class Parking {
  width = 0
  height = 0.25
  depth = 60
  #lotGap = 5

  constructor(employees: number) {
    this.width = (3+this.#lotGap)*Math.ceil(employees/2)
  }
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
    //scene.fog = new THREE.Fog(0xececec, 80, 400)

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
    controls.maxPolarAngle = Math.PI / 2 - 0.1

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

    const axesHelper = new THREE.AxesHelper( 5 );
    axesHelper.position.set(0, 2, 0)
    //scene.add( axesHelper );

    let mounted = true

    ;(async () => {
      if (!mounted) return

      // Load textures (local preferred) with safe fallbacks
      const [groundTex, buildingTex, facadeTex, roofTex, parkingTex] = await Promise.all([
        loadTextureSafe(grassTexure),
        loadTextureSafe(buildingTexture),
        loadTextureSafe(facadeTexture),
        loadTextureSafe('/assets/roof-fallback.png'),
        loadTextureSafe('/assets/parking-fallback.png'),
      ])

      groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping
      groundTex.repeat.set(80, 80)

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
      ground.position.set(0, 0, 0)
      ground.receiveShadow = true
      scene.add(ground)

      const factoryW = (input?.productionVolume as number)*0.4
      const factoryD = factoryW
      const factoryH = 80

      // Road: main horizontal axis
      const roadMat = new THREE.MeshStandardMaterial({ color: 0x333333 })
      const road = new THREE.Mesh(new THREE.BoxGeometry(1200, 0.25, 24), roadMat)
      road.position.set(0, 0.25, 0)
      road.receiveShadow = true
      scene.add(road)

      // Secondary road vertical
      const road2 = new THREE.Mesh(new THREE.BoxGeometry(24, 0.25, 1200), roadMat)
      road2.position.set(0, 0.25, 0)
      road2.receiveShadow = true
      scene.add(road2)

      const parkingAllGroup = new THREE.Group()
      let crntEmpl = input?.employeesCount as number
      let p = 0
      while (crntEmpl > 0) {
        const parkingGroup = new THREE.Group()
        const crnt = crntEmpl > 80 ? 80 : crntEmpl
        let parking
        if (crntEmpl > 80) {
          parking = new Parking(crnt)
        } else {
          parking = new Parking(crnt)
        }
        const parkingMat = new THREE.MeshStandardMaterial({ map: parkingTex, color: 0x808080 })
        const parkingStructure = new THREE.Mesh(new THREE.BoxGeometry(parking.width, parking.height, parking.depth), parkingMat)
        parkingStructure.receiveShadow = true
        parkingGroup.add(parkingStructure)

        const carsGroup = new THREE.Group()
        const carSpacing = 8
        carsGroup.rotateY(Math.PI/2)
        const parkingBox = new THREE.Box3().setFromObject(parkingGroup)
        for (let c = 0; c < (crnt); c++) {
          const carGeo = new THREE.BoxGeometry(8, 5, 4)
          const carMesh = new THREE.MeshStandardMaterial({ color: 0xffffff })
          const car = new THREE.Mesh(carGeo, carMesh)
          car.position.set(c>(Math.floor((crnt)/2)-1)?parkingBox.min.z+carSpacing:carSpacing, 0.25, parkingBox.min.x+4 + (c%Math.ceil((crnt)/2))*carSpacing)

          carsGroup.add(car)
        }
        parkingGroup.add(carsGroup)

        parkingGroup.position.set((parkingBox.max.x-parkingBox.min.x)/2, 0.25, 12+(parkingBox.max.z-parkingBox.min.z)*p)

        parkingAllGroup.add(parkingGroup)
        p += 1
        crntEmpl -= crnt
      }
      parkingAllGroup.position.set(12, 0.25, 30)
      const parkingAllGroupBox = new THREE.Box3().setFromObject(parkingAllGroup)
      scene.add(parkingAllGroup)

      // Factory building (textured)
      const facBaseGeo = new THREE.BoxGeometry(factoryW*1.5, 0.25, factoryD*1.2)
      const facBaseMat = new THREE.MeshStandardMaterial({ color: 0x808080 })
      const facBase = new THREE.Mesh(facBaseGeo, facBaseMat)

      const facBaseBox = new THREE.Box3().setFromObject(facBase)

      const facBuildingGeo = new THREE.BoxGeometry(factoryW, factoryH, factoryD)
      const facBuildingMat = new THREE.MeshStandardMaterial({ map: buildingTex, metalness: 0.2, roughness: 0.7 })
      const factoryBuilding = new THREE.Mesh(facBuildingGeo, facBuildingMat)
      factoryBuilding.position.set(facBaseBox.min.x+(factoryW/2)+5, factoryH/2, facBaseBox.max.z-(factoryW/2))
      const facRoofGeo = new THREE.BoxGeometry(factoryW * 0.98, factoryD * 0.98, 2)
      const facRoofMat = new THREE.MeshStandardMaterial({ map: roofTex })
      const factoryRoof = new THREE.Mesh(facRoofGeo, facRoofMat)
      factoryRoof.rotation.x = -Math.PI / 2
      factoryRoof.position.set(factoryBuilding.position.x, factoryH + 0.1, factoryBuilding.position.z)
      factoryRoof.receiveShadow = true
      const factory = new THREE.Group()
      factory.add(facBase)
      factory.add(factoryBuilding)
      factory.add(factoryRoof)

      const storageBuildingGeo = new THREE.BoxGeometry(factoryW*0.35, factoryH*0.35, factoryD*0.35)
      const storageBuildingMat = new THREE.MeshStandardMaterial({ map: buildingTex, metalness: 0.2, roughness: 0.7 })
      const storageBuilding = new THREE.Mesh(storageBuildingGeo, storageBuildingMat)
      storageBuilding.position.set(facBaseBox.max.x-((factoryW*0.35)/2)-5, (factoryH*0.35)/2, facBaseBox.max.z-((factoryW*0.35)/2))
      const storageRoofGeo = new THREE.BoxGeometry((factoryW * 0.98)*0.35, (factoryD * 0.98)*0.35, 2)
      const storageRoofMat = new THREE.MeshStandardMaterial({ map: roofTex })
      const storageRoof = new THREE.Mesh(storageRoofGeo, storageRoofMat)
      storageRoof.rotation.x = -Math.PI / 2
      storageRoof.position.set(storageBuilding.position.x, (factoryH*0.35) + 0.1, storageBuilding.position.z)
      storageRoof.receiveShadow = false
      const storage = new THREE.Group()
      storage.add(storageBuilding)
      storage.add(storageRoof)

      factory.add(storage)

      factory.position.set(-(12+(factoryW*1.5)/2), 0.25, (12+(factoryD*1.2)/2))
      factory.castShadow = true
      factory.receiveShadow = true
      scene.add(factory)

      const abkBaseGeo = new THREE.BoxGeometry(factoryW*0.2*1.5, 0.25, factoryD*0.2*1.2)
      const abkBaseMat = new THREE.MeshStandardMaterial({ color: 0x808080 })
      const abkBase = new THREE.Mesh(abkBaseGeo, abkBaseMat)
      const abkBaseBox = new THREE.Box3()
      abkBaseBox.setFromObject(abkBase)

      const abkBuildingGeo = new THREE.BoxGeometry(factoryW*0.2, 100, factoryD*0.2)
      const abkBuildingMat = new THREE.MeshStandardMaterial({ map: facadeTex, metalness: 0.2, roughness: 0.7 })
      const abkBuilding = new THREE.Mesh(abkBuildingGeo, abkBuildingMat)
      abkBuilding.position.set(abkBaseBox.max.x-(factoryW*0.2/2)-5, factoryH*0.2/2, abkBaseBox.min.z+5+(factoryD*0.2/2))
      const abkRoofGeo = new THREE.BoxGeometry(factoryW*0.2 * 0.98, factoryD*0.2 * 0.98, 2)
      const abkRoofMat = new THREE.MeshStandardMaterial({ map: roofTex })
      const abkRoof = new THREE.Mesh(abkRoofGeo, abkRoofMat)
      abkRoof.rotation.x = -Math.PI / 2
      abkRoof.position.set(abkBuilding.position.x, factoryH*0.2 + 0.1, abkBuilding.position.z)
      abkRoof.receiveShadow = false
      const abk = new THREE.Group()
      abk.add(abkBase)
      abk.add(abkBuilding)
      abk.add(abkRoof)

      abk.position.set(12+(factoryW*0.2*1.5/2), 0.25, -(12+(factoryD*0.2*1.2/2)))

      scene.add(abk)

      const socialZone = new THREE.Group()

      // Housing cluster (deterministic grid) on the east side
      const housingTerritory = new THREE.Group()
      const housingGroup = new THREE.Group()
      const housingCount = Math.ceil(Math.ceil((input?.employeesCount as number) * ((input?.housingPercent as number) / 100)) / 10)
      
      const housingSpacing = 36
      const houseW = 60
      const houseH = 75
      const houseMat = new THREE.MeshStandardMaterial({ map: facadeTex, color: 0xd9d9d9 })
      for (let row = 0; row < housingCount; row++) {
        const hGeo = new THREE.BoxGeometry(houseW, houseH, houseW * 0.6)
        const hMesh = new THREE.Mesh(hGeo, houseMat)
        hMesh.position.set((row%3)*((houseW/2)+housingSpacing*2), houseH / 2, Math.floor(row/3)*housingSpacing*2+(houseW * 0.6)/2)
        hMesh.castShadow = true
        hMesh.receiveShadow = true
        housingGroup.add(hMesh)
      }
      housingTerritory.add(housingGroup)

      
      const box = new THREE.Box3().setFromObject(housingTerritory)

      /*const housingRoad = new THREE.Mesh(new THREE.BoxGeometry(12, 0.25, (box.max.z-roadBox.max.z)-30+100), roadMat)
      housingRoad.position.set(housingGroupBox.getCenter(new THREE.Vector3(box.min.x, box.min.y, box.min.z)).x, 0.25, box.min.z)
      housingRoad.receiveShadow = true
      housingTerritory.add(housingRoad)*/

      /*const fenceGroup = new THREE.Group()
      if (box.isEmpty()) { housingTerritory.add(fenceGroup); return }

      housingGroup.position.set(0, 0, box.min.z-100)

      // corners в world -> перевести в локал housingTerritory
      const cornersWorld = [
        new THREE.Vector3(box.min.x, box.min.y, box.min.z+80),
        new THREE.Vector3(box.max.x, box.min.y, box.min.z+80),
        new THREE.Vector3(box.max.x, box.min.y, box.max.z-50),
        new THREE.Vector3(box.min.x, box.min.y, box.max.z-50),
      ]
      const cornersLocal = cornersWorld.map(v => v.clone() && housingTerritory.worldToLocal(v.clone()))

      // min в локал для Y основания
      const minLocal = housingTerritory.worldToLocal(box.min.clone())

      const postHeight = 3
      const postRadius = 0.15
      const postSpacing = 6
      const railHeight = 1.2
      const railThickness = 0.12

      const postGeom = new THREE.CylinderGeometry(postRadius, postRadius, postHeight, 12)
      const postMat = new THREE.MeshStandardMaterial({ color: 0x5b3a29 })
      const railMat = new THREE.MeshStandardMaterial({ color: 0xdeb887 })

      function addPostsAndRails(a: THREE.Vector3, b: THREE.Vector3) {
        const edge = new THREE.Vector3().subVectors(b, a)
        const length = edge.length()
        const count = Math.max(1, Math.ceil(length / postSpacing))
        const dir = edge.clone().normalize()

        // posts
        for (let i = 0; i <= count; i++) {
          const t = i / count
          const p = new THREE.Vector3().lerpVectors(a, b, t)
          const post = new THREE.Mesh(postGeom, postMat)
          post.position.copy(p)
          post.position.y = minLocal.y + postHeight / 2 // корректный локальный Y
          post.castShadow = true
          fenceGroup.add(post)
        }

        // rails: используем Box и quaternion для ориентации
        for (let i = 0; i < count; i++) {
          const pA = new THREE.Vector3().lerpVectors(a, b, i / count)
          const pB = new THREE.Vector3().lerpVectors(a, b, (i + 1) / count)
          const segLen = pA.distanceTo(pB)
          const mid = new THREE.Vector3().addVectors(pA, pB).multiplyScalar(0.5)

          for (let r = 0; r < 2; r++) {
            const railGeo = new THREE.BoxGeometry(segLen, railThickness, railThickness)
            const rail = new THREE.Mesh(railGeo, railMat)
            rail.position.copy(mid)
            rail.position.y = minLocal.y + railHeight + r * 0.3

            // направить локальную X ось вдоль edge
            const localX = new THREE.Vector3(1, 0, 0)
            const q = new THREE.Quaternion().setFromUnitVectors(localX, dir)
            rail.quaternion.copy(q)

            fenceGroup.add(rail)
          }
        }
      }

      for (let i = 0; i < 4; i++) {
        const a = cornersLocal[i]
        const b = cornersLocal[(i + 1) % 4]
        addPostsAndRails(a, b)
      }

      fenceGroup.position.set(0, 0.01, -100)
      housingTerritory.add(fenceGroup)*/
      housingTerritory.position.set(-(12 + (houseW+housingSpacing*2)*2), 0, -(12+(box.max.z-box.min.z))-75)
      socialZone.add(housingTerritory)

      const sceneBox = new THREE.Box3()
      sceneBox.setFromObject(scene)

      const kindergarten = new THREE.Group()

      const kindergartenSize = ((input?.employeesCount as number)/100)*(input?.kindergartenPlacesPer100 as number)*15/10*0.8
      const kindergartenBuildingGeo = new THREE.BoxGeometry(kindergartenSize*2, 75, kindergartenSize)
      const kindergartenBuildingMat = new THREE.MeshStandardMaterial({ map: facadeTex, metalness: 0.2, roughness: 0.7 })
      const kindergartenBuilding = new THREE.Mesh(kindergartenBuildingGeo, kindergartenBuildingMat)
      kindergarten.add(kindergartenBuilding)

      /*kindergarten.updateWorldMatrix(true, false)
      kindergartenBuilding.updateWorldMatrix(true, false)
      road.updateWorldMatrix(true, false)*/
      const kindergartenBuildingBox = new THREE.Box3().setFromObject(kindergartenBuilding)
      /*const kindRoadMat = new THREE.MeshStandardMaterial({ color: 0x333333 })
      
      const kindRoad = new THREE.Mesh(new THREE.BoxGeometry(75, 0.25, 24), kindRoadMat)
      const kindRoadBox = new THREE.Box3().setFromObject(kindRoad)
      kindRoad.rotateY(Math.PI/2)
      kindRoad.position.set(0, kindergartenBuildingBox.min.y, 200/2)
      kindRoad.receiveShadow = true
      kindergarten.add(kindRoad)
      const kindRoadHor = new THREE.Mesh(new THREE.BoxGeometry(180, 0.25, 24), kindRoadMat)
      kindRoadHor.position.set(kindRoadBox.min.x-50, kindergartenBuildingBox.min.y, 126)
      kindRoadHor.receiveShadow = true
      kindergarten.add(kindRoadHor) */

      kindergarten.rotateY(Math.PI/2)
      kindergarten.position.set(sceneBox.min.x+kindergartenSize/2+20, 75/2+0.25, (box.min.z-75)-(kindergartenBuildingBox.max.z-kindergartenBuildingBox.min.z))

      socialZone.add(kindergarten)

      scene.add(socialZone)

      // Параметры простого озера
      const radius = 64;
      const waterSeg = 64;

      // Группа озера
      const lakeGroup = new THREE.Group();

      // Вода: плоскость с простым синим материалом и динамическим смещением вершин
      const waterGeo = new THREE.CircleGeometry(radius, radius, waterSeg, waterSeg);
      waterGeo.rotateX(-Math.PI / 2);
      const waterMat = new THREE.MeshPhongMaterial({
        color: 0x1e90ff,
        transparent: true,
        opacity: 0.8,
        shininess: 40,
      });
      const waterMesh = new THREE.Mesh(waterGeo, waterMat);
      waterMesh.position.y = 0;
      lakeGroup.add(waterMesh);

      lakeGroup.position.set(sceneBox.max.z-(radius*6), 0.5, sceneBox.min.x+(radius*6))

      if (input?.landscaping.includes("Пруд")) {
        scene.add(lakeGroup);
      }
      const lakeGroupBox = new THREE.Box3().setFromObject(lakeGroup)

      // Дорожки к озеру с двух сторон
      const pathMat = new THREE.MeshStandardMaterial({ color: 0xb9a07a, roughness: 1, metalness: 0 })
      const pathWidth = 5.5
      const pathHeight = 0.18

      const westPath = new THREE.Mesh(new THREE.BoxGeometry(radius * 1.65, pathHeight, pathWidth), pathMat)
      westPath.position.set(lakeGroup.position.x - radius * 2.45+5, 0.09, lakeGroup.position.z - radius * 0.12)
      westPath.receiveShadow = true
      if (input?.landscaping.includes("Беседки")) {
        scene.add(westPath)
      }

      const southPath = new THREE.Mesh(new THREE.BoxGeometry(pathWidth, pathHeight, radius * 1.7), pathMat)
      southPath.position.set(lakeGroup.position.x + radius * 0.18, 0.09, lakeGroup.position.z + radius * 2.15+12)
      southPath.receiveShadow = true
      if (input?.landscaping.includes("Беседки")) {
        scene.add(southPath)
      }

      // Gazebos near the lake with short connecting paths
      function createGazebo(scale = 1.5) {
        const g = new THREE.Group()

        const deckRadius = 8 * scale
        const deckGeo = new THREE.CylinderGeometry(deckRadius, deckRadius, 0.3, 16)
        const deckMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b })
        const deck = new THREE.Mesh(deckGeo, deckMat)
        deck.position.y = 0.15 * scale
        deck.receiveShadow = true
        deck.castShadow = true
        g.add(deck)

        // Vertical posts
        const postHeight = 4 * scale
        const postGeo = new THREE.CylinderGeometry(0.18, 0.18, postHeight, 10)
        const postMat = new THREE.MeshStandardMaterial({ color: 0x5b3a29 })
        const posts = new THREE.Group()
        const postCount = 6
        for (let i = 0; i < postCount; i++) {
          const a = (i / postCount) * Math.PI * 2
          const px = Math.cos(a) * (deckRadius - 1.2)
          const pz = Math.sin(a) * (deckRadius - 1.2)
          const post = new THREE.Mesh(postGeo, postMat)
          post.position.set(px, (postHeight / 2) + deck.position.y, pz)
          post.castShadow = true
          posts.add(post)
        }
        g.add(posts)

        // Roof
        const roofGeo = new THREE.ConeGeometry(deckRadius * 1.15, 3.6 * scale, 8)
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x7f5a3c })
        const roof = new THREE.Mesh(roofGeo, roofMat)
        roof.position.y = postHeight + deck.position.y + 0.2
        roof.castShadow = true
        roof.receiveShadow = true
        g.add(roof)

        return g
      }

      function createPathBetween(a: THREE.Vector3, b: THREE.Vector3, width = 2.6) {
        const dir = new THREE.Vector3().subVectors(b, a)
        const len = dir.length()
        const geom = new THREE.BoxGeometry(len, pathHeight, width)
        const mesh = new THREE.Mesh(geom, pathMat)
        const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5)
        mesh.position.copy(mid)
        const localX = new THREE.Vector3(1, 0, 0)
        const q = new THREE.Quaternion().setFromUnitVectors(localX, dir.clone().normalize())
        mesh.quaternion.copy(q)
        mesh.receiveShadow = true
        mesh.castShadow = true
        return mesh
      }

      // Choose two gazebo positions that avoid the main roads and existing paths
      const gazeboPositions = [
        new THREE.Vector3(lakeGroup.position.x - radius * 1.6, 0, lakeGroup.position.z - radius * 0.5),
        new THREE.Vector3(lakeGroup.position.x + radius * 0.5, 0, lakeGroup.position.z + radius * 1.2),
      ]
      if (input?.landscaping.includes("Беседки")) {
        gazeboPositions.forEach((pos, idx) => {
          const g = createGazebo(1.5)
          g.position.set(pos.x, pos.y + 0.125, pos.z)
          scene.add(g)
  
          // Determine a sensible start point on the nearest approach path
          const start = (idx === 0 ? westPath.position.clone() : southPath.position.clone())
          start.y = 0.09
          const end = new THREE.Vector3(pos.x, 0.09, pos.z)
          const connector = createPathBetween(start, end, 2.6)
          scene.add(connector)
        })
      }

      // Плотные деревья вокруг озера
      const treeTrunkMat = new THREE.MeshStandardMaterial({ color: 0x6b3e1a })
      const foliageMat = new THREE.MeshStandardMaterial({ color: 0x2f8f5b })
      const treePositions: Array<{ x: number; z: number; scale: number }> = []

      // Сначала кольцо вокруг озера
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 16) {
        const ringRadius = radius * 1.6
        treePositions.push({
          x: lakeGroup.position.x + Math.cos(angle) * ringRadius,
          z: lakeGroup.position.z + Math.sin(angle) * ringRadius,
          scale: 1 + (Math.sin(angle * 3) + 1) * 0.18,
        })
      }

      // Добиваем плотность посадкой двух дополнительных колец и группами по берегу
      for (let angle = Math.PI / 10; angle < Math.PI * 2; angle += Math.PI / 12) {
        const innerRadius = radius * 1.95
        treePositions.push({
          x: lakeGroup.position.x + Math.cos(angle) * innerRadius,
          z: lakeGroup.position.z + Math.sin(angle) * innerRadius,
          scale: 0.92 + (Math.cos(angle * 2) + 1) * 0.12,
        })
      }

      for (let angle = Math.PI / 20; angle < Math.PI * 2; angle += Math.PI / 18) {
        const outerRadius = radius * 2.25
        treePositions.push({
          x: lakeGroup.position.x + Math.cos(angle) * outerRadius,
          z: lakeGroup.position.z + Math.sin(angle) * outerRadius,
          scale: 0.82 + (Math.sin(angle * 5) + 1) * 0.1,
        })
      }

      // Убираем деревья с дорожек и добавляем больше на свободных участках
      const filteredTreePositions = treePositions
        .filter((item) => {
          const onWestPath = Math.abs(item.z - (lakeGroup.position.z - radius * 0.12)) < 5.5 && item.x < lakeGroup.position.x - radius * 0.8
          const onSouthPath = Math.abs(item.x - (lakeGroup.position.x + radius * 0.18)) < 5.5 && item.z > lakeGroup.position.z + radius * 1.95
          return !onWestPath && !onSouthPath
        })
        .slice(0, 100)

      while (filteredTreePositions.length < 100) {
        const angle = (filteredTreePositions.length / 100) * Math.PI * 2
        filteredTreePositions.push({
          x: lakeGroup.position.x + Math.cos(angle) * radius * 2.05,
          z: lakeGroup.position.z + Math.sin(angle) * radius * 2.05,
          scale: 0.9,
        })
      }

      if (input?.landscaping.includes("Аллея")) {
        filteredTreePositions.forEach((item, index) => {
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 3.2, 8), treeTrunkMat)
          trunk.position.set(item.x, 1.6, item.z)
          trunk.castShadow = true
          scene.add(trunk)
  
          const crownHeight = index % 4 === 0 ? 4.4 : index % 3 === 0 ? 3.8 : 3.2
          const foliage = new THREE.Mesh(
            new THREE.ConeGeometry(1.8 * item.scale, crownHeight * item.scale, 8),
            foliageMat,
          )
          foliage.position.set(item.x, 4.6, item.z)
          foliage.castShadow = true
          scene.add(foliage)
        })
      }

      // Replace with wooden stage + stepped amphitheater seating (as in reference)
      const arrowSceneGroup = new THREE.Group()

      // materials
      const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b })
      const woodDark = new THREE.MeshStandardMaterial({ color: 0x5b3a29 })
      const tileMat = new THREE.MeshStandardMaterial({ color: 0xe6e2d8 })
      const backdropMat = new THREE.MeshStandardMaterial({ color: 0xffffff })

      // tiled plaza (square) - use Box to give slight thickness
      const plazaSize = 36
      const plazaGeo = new THREE.BoxGeometry(plazaSize, 0.6, plazaSize)
      const plaza = new THREE.Mesh(plazaGeo, tileMat)
      plaza.position.y = 0.3
      plaza.receiveShadow = true
      arrowSceneGroup.add(plaza)

      // stage platform
      const stageW = 14
      const stageD = 8
      const stageH = 1
      const stageGeo = new THREE.BoxGeometry(stageW, stageH, stageD)
      const stage = new THREE.Mesh(stageGeo, woodMat)
      stage.position.set(0, stageH / 2 + 0.6, - (plazaSize / 2 - stageD / 2) + 2)
      stage.castShadow = true
      stage.receiveShadow = true
      arrowSceneGroup.add(stage)

      // back wall (clean white backdrop)
      const backWallGeo = new THREE.BoxGeometry(stageW, 6, 0.6)
      const backWall = new THREE.Mesh(backWallGeo, backdropMat)
      backWall.position.set(stage.position.x, stage.position.y + 3.2, stage.position.z - (stageD / 2) - 0.3)
      backWall.receiveShadow = true
      arrowSceneGroup.add(backWall)

      // roof over stage: horizontal slab with vertical wooden slats on left side
      const roofGeo = new THREE.BoxGeometry(stageW + 2, 0.6, stageD + 6)
      const roof = new THREE.Mesh(roofGeo, woodMat)
      roof.position.set(stage.position.x, backWall.position.y + 2.6, backWall.position.z + (roofGeo.parameters.depth ? 0 : 0))
      roof.castShadow = true
      roof.receiveShadow = true
      arrowSceneGroup.add(roof)

      // vertical slats on the left side of stage (decorative)
      const slatW = 0.5
      const slatH = 4.6
      for (let i = -6; i <= 6; i += 1.5) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(slatW, slatH, 0.12), woodDark)
        slat.position.set(stage.position.x - stageW / 2 + 1 + i, stage.position.y + slatH / 2 + 0.6, stage.position.z - stageD / 2 - 0.2)
        slat.castShadow = true
        arrowSceneGroup.add(slat)
      }

      // amphitheater stepped benches (semi-circular continuous segments)
      const rows = 4
      const rowHeight = 0.5
      const innerRadius = 8
      const arc = Math.PI * 1.2 // wide arc
      const segmentsPerRow = 8
      for (let r = 0; r < rows; r++) {
        const radius = innerRadius + r * 2.6
        const y = 0.6 + r * rowHeight
        const depth = 1.2
        const benchHeight = 0.5
        const benchMat = woodDark
        // split arc into a few wider curved segments to resemble continuous benches
        for (let seg = 0; seg < segmentsPerRow; seg++) {
          const t0 = (-arc / 2) + (seg / segmentsPerRow) * arc
          const t1 = (-arc / 2) + ((seg + 1) / segmentsPerRow) * arc
          const mid = (t0 + t1) / 2
          const segLen = Math.abs(radius * (t1 - t0))
          const benchGeo = new THREE.BoxGeometry(Math.max(1, segLen * 0.95), benchHeight, depth)
          const bench = new THREE.Mesh(benchGeo, benchMat)
          const x = Math.sin(mid) * radius
          const z = Math.cos(mid) * radius + 4
          bench.position.set(x, y + benchHeight / 2, z)
          // rotate bench to follow arc tangent
          const angle = mid
          bench.rotation.y = angle
          bench.castShadow = true
          bench.receiveShadow = true
          arrowSceneGroup.add(bench)
        }
      }

      // place group in same NW quadrant
      arrowSceneGroup.position.set(12+18, 1, sceneBox.min.z+300)
      arrowSceneGroup.traverse((o) => {
        if ((o as any).isMesh) {
          ;(o as any).castShadow = true
          ;(o as any).receiveShadow = true
        }
      })
      arrowSceneGroup.rotateY(-Math.PI/2)
      if (input?.landscaping.includes("Сцена")) {
        scene.add(arrowSceneGroup)
      }

      // --- Public square with fountain ---
      const squareGroup = new THREE.Group()

      // square paving
      const squareSize = 22
      const squareGeo = new THREE.BoxGeometry(squareSize, 0.4, squareSize)
      const square = new THREE.Mesh(squareGeo, tileMat)
      square.position.y = 0.2
      square.receiveShadow = true
      squareGroup.add(square)

      // fountain: outer ring + water disc + central jet
      const ringGeo = new THREE.TorusGeometry(4, 0.6, 16, 64)
      const ring = new THREE.Mesh(ringGeo, woodDark)
      ring.rotation.x = Math.PI / 2
      ring.position.y = 0.6
      ring.castShadow = true
      squareGroup.add(ring)

      const fountainWater = new THREE.Mesh(new THREE.CircleGeometry(3.4, 32), waterMat)
      fountainWater.rotation.x = -Math.PI / 2
      fountainWater.position.y = 0.62
      fountainWater.receiveShadow = true
      squareGroup.add(fountainWater)

      const jetGeo = new THREE.CylinderGeometry(0.3, 0.5, 1.6, 12)
      const jetMat = new THREE.MeshStandardMaterial({ color: 0xcfe8ff, emissive: 0x88d0ff, transparent: true, opacity: 0.9 })
      const jet = new THREE.Mesh(jetGeo, jetMat)
      jet.position.y = 1.5
      jet.castShadow = false
      squareGroup.add(jet)

      // benches around fountain
      const benchGeo = new THREE.BoxGeometry(4, 0.5, 0.8)
      for (let i = 0; i < 4; i++) {
        const b = new THREE.Mesh(benchGeo, woodDark)
        const ang = (i / 4) * Math.PI * 2
        const bx = Math.cos(ang) * 7
        const bz = Math.sin(ang) * 7
        b.position.set(bx, 0.5, bz)
        b.lookAt(0, 0.5, 0)
        b.castShadow = true
        squareGroup.add(b)
      }

      // four lampposts at corners
      const lampPoleGeo = new THREE.CylinderGeometry(0.12, 0.12, 2.6, 8)
      const bulbGeo = new THREE.SphereGeometry(0.22, 8, 8)
      for (let sx of [-1, 1]) for (let sz of [-1, 1]) {
        const lx = sx * (squareSize / 2 - 2)
        const lz = sz * (squareSize / 2 - 2)
        const pole = new THREE.Mesh(lampPoleGeo, new THREE.MeshStandardMaterial({ color: 0x5b3a29 }))
        pole.position.set(lx, 1.3, lz)
        pole.castShadow = true
        const bulb = new THREE.Mesh(bulbGeo, new THREE.MeshStandardMaterial({ color: 0xfff0c8, emissive: 0xffe6a0, emissiveIntensity: 0.6 }))
        bulb.position.set(lx, 2.6, lz)
        squareGroup.add(pole)
        squareGroup.add(bulb)
      }

      // small ornamental trees flanking the square
      const tLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.8, 8), treeTrunkMat)
      tLeft.position.set(-squareSize / 2 - 2, 0.9, 0)
      const fLeft = new THREE.Mesh(new THREE.ConeGeometry(1.2, 3, 8), foliageMat)
      fLeft.position.set(-squareSize / 2 - 2, 3, 0)
      squareGroup.add(tLeft)
      squareGroup.add(fLeft)

      const tRight = tLeft.clone()
      tRight.position.set(squareSize / 2 + 2, 0.9, 0)
      const fRight = fLeft.clone()
      fRight.position.set(squareSize / 2 + 2, 3, 0)
      squareGroup.add(tRight)
      squareGroup.add(fRight)

      // place the square near the main road on the west side
      squareGroup.position.set(12+11, 0, sceneBox.min.z+220)
      squareGroup.rotateY(Math.PI/2)
      squareGroup.traverse((o) => { if ((o as any).isMesh) { (o as any).castShadow = true; (o as any).receiveShadow = true } })
      if (input?.landscaping.includes("Сквер с фонтаном")) {
        scene.add(squareGroup)
      }

      // --- Small dedicated art plaza (pedestal + sculpture, benches, lamps) ---
      const artPlaza = new THREE.Group()
      const artPlazaSize = 10
      const artPlazaGeo = new THREE.BoxGeometry(artPlazaSize, 0.4, artPlazaSize)
      const artPlazaMesh = new THREE.Mesh(artPlazaGeo, tileMat)
      artPlazaMesh.position.y = 0.2   
      artPlaza.add(artPlazaMesh)

      // small pedestal and sculpture (simpler knot)
      const pedGeo2 = new THREE.CylinderGeometry(0.8, 1.0, 0.6, 24)
      const ped2 = new THREE.Mesh(pedGeo2, new THREE.MeshStandardMaterial({ color: 0x222222 }))
      ped2.position.y = 0.35
      artPlaza.add(ped2)

      const sculptureGeo = new THREE.TorusKnotGeometry(1.2, 0.28, 64, 16, 2, 3)
      const sculpture = new THREE.Mesh(sculptureGeo, new THREE.MeshStandardMaterial({ color: 0xd24a4a, metalness: 0.8, roughness: 0.18 }))
      sculpture.position.y = 2.2
      sculpture.castShadow = true
      artPlaza.add(sculpture)

      // two benches and two lamps around small plaza
      const bGeo = new THREE.BoxGeometry(2.6, 0.45, 0.7)
      const benchA = new THREE.Mesh(bGeo, woodDark)
      benchA.position.set(-3, 0.45, 0)
      benchA.lookAt(0, 0.45, 0)
      artPlaza.add(benchA)
      const benchB = benchA.clone()
      benchB.position.set(3, 0.45, 0)
      artPlaza.add(benchB)

      const poleGeo2 = new THREE.CylinderGeometry(0.08, 0.08, 2.2, 8)
      const bulbGeo2 = new THREE.SphereGeometry(0.18, 8, 8)
      const pole1 = new THREE.Mesh(poleGeo2, new THREE.MeshStandardMaterial({ color: 0x333333 }))
      pole1.position.set(-3.6, 1.1, -3.6)
      const bulb1 = new THREE.Mesh(bulbGeo2, new THREE.MeshStandardMaterial({ color: 0xfff0c8, emissive: 0xffe6a0, emissiveIntensity: 0.6 }))
      bulb1.position.set(-3.6, 2.2, -3.6)
      artPlaza.add(pole1); artPlaza.add(bulb1)
      const pole2 = pole1.clone()
      pole2.position.set(3.6, 1.1, -3.6)
      const bulb2 = bulb1.clone()
      bulb2.position.set(3.6, 2.2, -3.6)
      artPlaza.add(pole2); artPlaza.add(bulb2)

      // place art plaza as a small separate spot west of main square
      artPlaza.position.set(squareGroup.position.x - 5, 0, squareGroup.position.z - 40)
      artPlaza.traverse((o) => { if ((o as any).isMesh) { (o as any).castShadow = true; (o as any).receiveShadow = true } })
      if (input?.landscaping.includes("Арт-объект")) {
        scene.add(artPlaza)
      }
      // --- Exercise plaza (new, robust) ---
      function createExercisePlazaAt(x: number, z: number) {
        const center = new THREE.Vector3(x, 0, z)
        const root = new THREE.Group()
        root.name = 'exercisePlaza'

        const size = 14
        const platform = new THREE.Mesh(new THREE.BoxGeometry(size, 0.35, size), tileMat)
        platform.position.y = 0.175
        root.add(platform)

        // benches
        const benchGeoLocal = new THREE.BoxGeometry(3.0, 0.45, 0.7)
        const benchMatLocal = new THREE.MeshStandardMaterial({ color: 0x7b4f29 })
        const benches = [
          new THREE.Vector3(0, 0, -size / 2 - 1.2),
          new THREE.Vector3(0, 0, size / 2 + 1.2),
          new THREE.Vector3(-size / 2 - 1.2, 0, 0),
          new THREE.Vector3(size / 2 + 1.2, 0, 0),
        ]
        benches.forEach((bp) => {
          const b = new THREE.Mesh(benchGeoLocal, benchMatLocal)
          b.position.set(bp.x, 0.45, bp.z)
          // explicit bench rotation so it faces plaza center (local coords)
          if (Math.abs(bp.x) > 0.1) {
            b.rotation.y = bp.x > 0 ? -Math.PI / 2 : Math.PI / 2
          } else {
            b.rotation.y = bp.z > 0 ? 0 : Math.PI
          }
          b.rotation.x = 0
          b.rotation.z = 0
          b.castShadow = true
          b.receiveShadow = true
          root.add(b)
        })

        // equipment group
        const eq = new THREE.Group()
        eq.name = 'exerciseGroup'
        root.add(eq)

        const postMat = new THREE.MeshStandardMaterial({ color: 0x5b3a29 })
        const metalMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9 })

        function addPullUp(x: number, z: number, angle = 0) {
          const h = 2.4, w = 1.8
          const postGeo = new THREE.CylinderGeometry(0.08, 0.08, h, 8)
          const pa = new THREE.Mesh(postGeo, postMat)
          const pb = pa.clone()
          pa.position.set(x + Math.sin(angle) * (w / 2), h / 2, z + Math.cos(angle) * (w / 2))
          pb.position.set(x - Math.sin(angle) * (w / 2), h / 2, z - Math.cos(angle) * (w / 2))
          const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, 0.08), metalMat)
          bar.position.set(x, h - 0.06, z)
          bar.rotation.y = Math.PI/2
          eq.add(pa, pb, bar)
        }

        function addParallel(x: number, z: number, angle = 0) {
          const len = 2.4, gap = 0.6, h = 1.0
          for (let s of [-1, 1]) {
            const bx = x + Math.sin(angle) * s * (gap / 2)
            const bz = z + Math.cos(angle) * s * (gap / 2)
            const bar = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.08), new THREE.MeshStandardMaterial({ color: 0x8b5a2b }))
            bar.position.set(bx, h - 0.06, bz)
            bar.rotation.y = angle
            eq.add(bar)
          }
        }

        function addMonkey(x: number, z: number, angle = 0) {
          const span = 2.6, rungs = 6, h = 1.9
          const half = span / 2
          const postGeo = new THREE.CylinderGeometry(0.08, 0.08, h, 8)
          const pA = new THREE.Mesh(postGeo, postMat)
          const pB = pA.clone()
          pA.position.set(x + Math.sin(angle) * half, h / 2, z + Math.cos(angle) * half)
          pB.position.set(x - Math.sin(angle) * half, h / 2, z - Math.cos(angle) * half)
          eq.add(pA, pB)
          for (let i = 0; i < rungs; i++) {
            const t = i / (rungs - 1)
            const rx = x + Math.sin(angle) * (half - t * span)
            const rz = z + Math.cos(angle) * (half - t * span)
            const rung = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.9), metalMat)
            rung.position.set(rx, h - 0.12, rz)
            rung.rotation.y = angle + Math.PI / 2
            eq.add(rung)
          }
        }

        function addBalance(x: number, z: number, angle = 0) {
          const beam = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.12, 0.18), new THREE.MeshStandardMaterial({ color: 0x5b3a29 }))
          beam.position.set(x, 0.25, z)
          beam.rotation.y = angle
          eq.add(beam)
        }

        // arrange stations (local coords)
        addPullUp(-3.5, -2.5)
        addParallel(3.5, -2.5, Math.PI / 2)
        addMonkey(-3.5, 2.5)
        addBalance(3.5, 2.5)

        // normalize rotations and enable shadows for equipment
        eq.traverse((o) => {
          if ((o as any).isMesh) {
            // avoid accidental tilts
            o.rotation.x = 0
            o.rotation.z = 0
            ;(o as any).castShadow = true
            ;(o as any).receiveShadow = true
          }
        })

        root.position.copy(center)
        root.rotation.set(0, 0, 0)
        return root
      }

      // add exercise plaza near square
      const exercisePlazaCenter = new THREE.Vector3(squareGroup.position.x - 18, 0, squareGroup.position.z)
      const exercisePlazaNode = createExercisePlazaAt(exercisePlazaCenter.x, exercisePlazaCenter.z)
      exercisePlazaNode.position.set(12+10, 0.5, sceneBox.min.z+400)
      if (input?.sports.includes("Уличные тренажёры")) {
        scene.add(exercisePlazaNode)
      }

      // --- Stadium: field + track + stands ---
      function createStadium(centerX: number, centerZ: number, fieldW = 40, fieldD = 70) {
        const root = new THREE.Group()
        root.name = 'stadium'

        // playing field
        const fieldMat = new THREE.MeshStandardMaterial({ color: 0x1b7a1b })
        const field = new THREE.Mesh(new THREE.BoxGeometry(fieldW, 0.12, fieldD), fieldMat)
        field.position.y = 0.06
        root.add(field)

        // running track (approximate with a scaled torus)
        const trackRadius = Math.max(fieldW, fieldD) / 2 + 3
        const track = new THREE.Mesh(new THREE.TorusGeometry(trackRadius, 2.4, 16, 160), new THREE.MeshStandardMaterial({ color: 0xb64f3b }))
        track.rotation.x = Math.PI / 2
        // stretch on Z to make oval-like
        track.scale.set(1, 1, fieldD / fieldW)
        track.position.y = 0.2
        root.add(track)

        // stands on long sides (stepped rows)
        const standMat = new THREE.MeshStandardMaterial({ color: 0x666666 })
        const rows = 8
        const rowHeight = 0.5
        const stepWidth = 2.0
        for (let r = 0; r < rows; r++) {
          const h = (r + 1) * rowHeight
          const w = stepWidth
          const depth = fieldD * 0.95
          const left = new THREE.Mesh(new THREE.BoxGeometry(w, rowHeight, depth), standMat)
          const right = left.clone()
          // place along X sides
          const offsetX = fieldW / 2 + w / 2 + r * w
          left.position.set(-offsetX, h - rowHeight / 2 + 0.1, 0)
          right.position.set(offsetX, h - rowHeight / 2 + 0.1, 0)
          left.castShadow = left.receiveShadow = true
          right.castShadow = right.receiveShadow = true
          root.add(left)
          root.add(right)
        }

        // simple spectator roof (over center rows)
        const roofGeo = new THREE.BoxGeometry(fieldW * 0.9, 0.6, fieldD * 0.4)
        const roof = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({ color: 0x4a4a4a }))
        roof.position.set(0, rows * rowHeight + 0.6, 0)
        root.add(roof)

        // floodlights at corners
        const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 8, 8)
        const lightGeo = new THREE.SphereGeometry(0.22, 8, 8)
        const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff7d6, emissive: 0xffe6a0, emissiveIntensity: 0.4 })
        const corners = [
          [-fieldW / 2 - 4, fieldD / 2 + 6],
          [fieldW / 2 + 4, fieldD / 2 + 6],
          [-fieldW / 2 - 4, -fieldD / 2 - 6],
          [fieldW / 2 + 4, -fieldD / 2 - 6],
        ]
        for (const c of corners) {
          const p = new THREE.Mesh(poleGeo, new THREE.MeshStandardMaterial({ color: 0x333333 }))
          p.position.set(c[0], 4, c[1])
          const bulb = new THREE.Mesh(lightGeo, lightMat)
          bulb.position.set(c[0], 8.2, c[1])
          root.add(p)
          root.add(bulb)
        }

        // outline path and small entrance platform
        const entrance = new THREE.Mesh(new THREE.BoxGeometry(fieldW * 0.4, 0.15, 6), new THREE.MeshStandardMaterial({ color: 0xdddddd }))
        entrance.position.set(0, 0.075, -fieldD / 2 - 4)
        root.add(entrance)

        root.position.set(centerX, 0, centerZ)
        root.traverse((o) => { if ((o as any).isMesh) { (o as any).castShadow = true; (o as any).receiveShadow = true } })
        return root
      }

      // add stadium next to exercise plaza (further along same axis)
      const stadiumCenter = new THREE.Vector3(exercisePlazaNode.position.x + 0, 0, exercisePlazaNode.position.z + 120)
      const stadiumNode = createStadium(stadiumCenter.x, stadiumCenter.z, 36, 84)
      stadiumNode.position.set(12+68, 5, parkingAllGroupBox.max.z+100)
      if (input?.sports.includes("Стадион")) {
        scene.add(stadiumNode)
      }

      // --- Outdoor pool (deck, basin, water, loungers) ---
      function createPoolAt(x: number, z: number, poolW = 28, poolD = 12) {
        const root = new THREE.Group()
        root.name = 'pool'

        const deckMat = new THREE.MeshStandardMaterial({ color: 0xd9d0c8 })
        const deckThickness = 0.25
        const border = 4 // half of extra deck beyond pool

        // surround pool with four deck strips so pool stays open
        const leftStrip = new THREE.Mesh(new THREE.BoxGeometry(border, deckThickness, poolD + 8), deckMat)
        leftStrip.position.set(-poolW / 2 - border / 2, deckThickness / 2, 0)
        const rightStrip = leftStrip.clone()
        rightStrip.position.set(poolW / 2 + border / 2, deckThickness / 2, 0)
        const topStrip = new THREE.Mesh(new THREE.BoxGeometry(poolW, deckThickness, border), deckMat)
        topStrip.position.set(0, deckThickness / 2, poolD / 2 + border / 2)
        const bottomStrip = topStrip.clone()
        bottomStrip.position.set(0, deckThickness / 2, -poolD / 2 - border / 2)
        root.add(leftStrip, rightStrip, topStrip, bottomStrip)

        const basinMat = new THREE.MeshStandardMaterial({ color: 0x9fbfdc })
        // lower basin so its top sits slightly below deck level
        const basinHeight = 0.6
        const basin = new THREE.Mesh(new THREE.BoxGeometry(poolW, basinHeight, poolD), basinMat)
        basin.position.y = -0.35
        root.add(basin)

        // pool rim (thin tile around pool edge)
        const rim = new THREE.Mesh(new THREE.BoxGeometry(poolW + 0.2, 0.12, poolD + 0.2), new THREE.MeshStandardMaterial({ color: 0xf2efe9 }))
        rim.position.y = -0.35 + basinHeight / 2 + 0.06
        root.add(rim)

        // use existing waterMat for consistency; place water slightly below rim
        const waterPlane = new THREE.Mesh(new THREE.PlaneGeometry(poolW - 0.4, poolD - 0.4), waterMat)
        waterPlane.rotation.x = -Math.PI / 2
        waterPlane.position.y = -0.38
        root.add(waterPlane)

        // ladder
        const ladderMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9 })
        const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.2, 8)
        const lp1 = new THREE.Mesh(poleGeo, ladderMat)
        const lp2 = lp1.clone()
        lp1.position.set(poolW / 2 - 1.2, 0.6, -poolD / 2 + 1.2)
        lp2.position.set(poolW / 2 - 2.0, 0.6, -poolD / 2 + 1.2)
        root.add(lp1, lp2)

        // loungers
        const loungerGeo = new THREE.BoxGeometry(2.4, 0.15, 0.6)
        const loungerMat = new THREE.MeshStandardMaterial({ color: 0x7b4f29 })
        for (let i = -1; i <= 1; i++) {
          const lx = -poolW / 2 + 3 + i * 3.5
          const lz = poolD / 2 + 2
          const lounger = new THREE.Mesh(loungerGeo, loungerMat)
          lounger.position.set(lx, 0.2, lz)
          lounger.rotation.x = -0.15
          root.add(lounger)
        }

        // parasol
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 8), new THREE.MeshStandardMaterial({ color: 0x333333 }))
        const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.0, 0.8, 16), new THREE.MeshStandardMaterial({ color: 0xff5555 }))
        pole.position.set(poolW / 2 - 3.5, 0.8, poolD / 2 + 2)
        canopy.position.set(poolW / 2 - 3.5, 1.6, poolD / 2 + 2)
        root.add(pole, canopy)

        root.position.set(x, 0, z)
        root.traverse((o) => { if ((o as any).isMesh) { (o as any).castShadow = true; (o as any).receiveShadow = true } })
        return root
      }

      const poolPos = new THREE.Vector3(stadiumNode.position.x, 0, stadiumNode.position.z + 80)
      const poolNode = createPoolAt(poolPos.x, poolPos.z, 28, 12)
      poolNode.position.set(12+20, 0.5, sceneBox.min.z+450)
      if (input?.sports.includes("Бассейн")) {
        scene.add(poolNode)
      }

      // --- Gym hall (indoor sports building) ---
      function createGymAt(x: number, z: number) {
        const root = new THREE.Group()
        root.name = 'gymHall'

        const gymW = 42
        const gymH = 14
        const gymD = 28

        const gymWallMat = new THREE.MeshStandardMaterial({ map: facadeTex, roughness: 0.7, metalness: 0.05 })
        const gymBody = new THREE.Mesh(new THREE.BoxGeometry(gymW, gymH, gymD), gymWallMat)
        gymBody.position.y = gymH / 2
        root.add(gymBody)

        // roof
        const roof = new THREE.Mesh(new THREE.BoxGeometry(gymW + 1.2, 0.8, gymD + 1.2), new THREE.MeshStandardMaterial({ color: 0x4d4d4d }))
        roof.position.y = gymH + 0.4
        root.add(roof)

        // front entrance block
        const entranceBlock = new THREE.Mesh(new THREE.BoxGeometry(8, 5.5, 4.5), new THREE.MeshStandardMaterial({ color: 0xe6e2d8 }))
        entranceBlock.position.set(0, 2.75, gymD / 2 + 2.2)
        root.add(entranceBlock)

        // entrance stairs
        for (let i = 0; i < 3; i++) {
          const step = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.25, 0.9), new THREE.MeshStandardMaterial({ color: 0xc9c9c9 }))
          step.position.set(0, 0.125 + i * 0.25, gymD / 2 + 4 + i * 0.7)
          root.add(step)
        }

        // windows on both long facades
        const winMat = new THREE.MeshStandardMaterial({ color: 0x8fc4e8, transparent: true, opacity: 0.8 })
        const winGeo = new THREE.BoxGeometry(3.2, 2.2, 0.15)
        for (let i = -4; i <= 4; i += 2) {
          const wFront = new THREE.Mesh(winGeo, winMat)
          const wBack = wFront.clone()
          wFront.position.set(i * 3.2, 8, gymD / 2 + 0.12)
          wBack.position.set(i * 3.2, 8, -gymD / 2 - 0.12)
          root.add(wFront, wBack)
        }

        // side service doors
        const doorMat = new THREE.MeshStandardMaterial({ color: 0x2f2f2f })
        const sideDoorL = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.6, 0.18), doorMat)
        const sideDoorR = sideDoorL.clone()
        sideDoorL.position.set(-gymW / 2 + 0.12, 1.3, 0)
        sideDoorL.rotation.y = Math.PI / 2
        sideDoorR.position.set(gymW / 2 - 0.12, 1.3, 0)
        sideDoorR.rotation.y = Math.PI / 2
        root.add(sideDoorL, sideDoorR)

        // path in front of entrance
        const frontPath = new THREE.Mesh(new THREE.BoxGeometry(12, 0.15, 9), new THREE.MeshStandardMaterial({ color: 0xd8d0c2 }))
        frontPath.position.set(0, 0.075, gymD / 2 + 8.8)
        root.add(frontPath)

        root.position.set(x, 0, z)
        root.traverse((o) => { if ((o as any).isMesh) { (o as any).castShadow = true; (o as any).receiveShadow = true } })
        return root
      }

      const gymPos = new THREE.Vector3(poolNode.position.x + 60, 0, poolNode.position.z + 10)
      const gymNode = createGymAt(gymPos.x, gymPos.z)
      gymNode.position.set(abkBaseBox.max.x+100, 0.5, -12-30)
      if (input?.sports.includes("Спортзал")) {
        scene.add(gymNode)
      }

      // --- Dining hall / столовая ---
      function createDiningHallAt(x: number, z: number, employees: number) {
        const root = new THREE.Group()
        root.name = 'diningHall'

        // area per formula: employees * 0.5 m^2
        const area = Math.max(36, (employees || 0) * 0.5)*100 // minimum footprint
        const side = Math.sqrt(area)
        const hallW = Math.max(8, side)
        const hallD = Math.max(8, side)

        const wallMat = new THREE.MeshStandardMaterial({ map: facadeTex, color: 0xf2efe9 })
        const roofMatLocal = new THREE.MeshStandardMaterial({ color: 0x6b6b6b })

        // building volume
        const body = new THREE.Mesh(new THREE.BoxGeometry(hallW, 6, hallD), wallMat)
        body.position.y = 6 / 2
        root.add(body)

        // roof
        const roof = new THREE.Mesh(new THREE.BoxGeometry(hallW + 1.2, 0.6, hallD + 1.2), roofMatLocal)
        roof.position.y = 6 + 0.35
        root.add(roof)

        // entrance (front) and small canopy
        const doorMat = new THREE.MeshStandardMaterial({ color: 0x342d2a })
        const entrance = new THREE.Mesh(new THREE.BoxGeometry(3, 2.8, 0.2), doorMat)
        entrance.position.set(0, 1.4, hallD / 2 + 0.11)
        root.add(entrance)

        const canopy = new THREE.Mesh(new THREE.BoxGeometry(6, 0.2, 1.2), roofMatLocal)
        canopy.position.set(0, 2.9, hallD / 2 + 0.6)
        root.add(canopy)

        // windows along long sides
        const winMat = new THREE.MeshStandardMaterial({ color: 0x9fd3f0, transparent: true, opacity: 0.85 })
        const winGeo = new THREE.BoxGeometry(1.8, 1.4, 0.12)
        const count = Math.max(2, Math.floor(hallW / 6))
        for (let i = 0; i < count; i++) {
          const xPos = -hallW / 2 + 1.2 + (i * (hallW - 2.4)) / Math.max(1, count - 1)
          const w1 = new THREE.Mesh(winGeo, winMat)
          w1.position.set(xPos, 3.6, hallD / 2 + 0.11)
          const w2 = w1.clone()
          w2.position.set(xPos, 3.6, -hallD / 2 - 0.11)
          root.add(w1, w2)
        }

        // simple interior tables (visible from above) and service counter
        const tableMat = new THREE.MeshStandardMaterial({ color: 0xd8b48a })
        const chairMat = new THREE.MeshStandardMaterial({ color: 0x7b4f29 })

        // outdoor seating / terrace in front
        const terraceW = Math.min(hallW, 12)
        const terrace = new THREE.Mesh(new THREE.BoxGeometry(terraceW, 0.18, 3.0), new THREE.MeshStandardMaterial({ color: 0xd9d0c8 }))
        terrace.position.set(0, 0.09, hallD / 2 + 2.0)
        root.add(terrace)

        // a couple of outdoor tables
        for (let i = -1; i <= 1; i += 2) {
          const ot = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.12, 12), tableMat)
          ot.position.set(i * 2.2, 0.6, hallD / 2 + 2.0)
          root.add(ot)
          const os = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), chairMat)
          os.position.set(i * 2.2 + 0.9, 0.4, hallD / 2 + 2.0)
          root.add(os)
        }

        // small paved path to entrance
        const path = new THREE.Mesh(new THREE.BoxGeometry(4, 0.12, 6), new THREE.MeshStandardMaterial({ color: 0xd8d0c2 }))
        path.position.set(0, 0.06, hallD / 2 + 5)
        root.add(path)

        root.position.set(x, 0, z)
        root.traverse((o) => { if ((o as any).isMesh) { (o as any).castShadow = true; (o as any).receiveShadow = true } })
        return root
      }

      // instantiate dining hall sized by employees
      const diningNode = createDiningHallAt(abkBaseBox.max.x + 40, sceneBox.min.z + 260, (input?.employeesCount as number) || 100)
      diningNode.position.set(-12-60, 0.5, box.isEmpty() ? -12-(Math.sqrt(Math.max(36, ((input?.employeesCount as number) || 0) * 0.5)*100)) : sceneBox.min.z+100)
      if (!box.isEmpty()) {
        diningNode.rotateY(Math.PI/2)
      }
      scene.add(diningNode)

      // --- Medical post (медпункт) ---
      function createMedicalPostAt(x: number, z: number, employees: number) {
        const root = new THREE.Group()
        root.name = 'medicalPost'

        // compute area: employees * 0.1 m^2, min 20 m^2
        const area = Math.max(20, (employees || 0) * 0.1)*100
        // scale factor for scene units (existing buildings use approx 1 unit ~= 1m), keep moderate size
        const side = Math.sqrt(area)
        const w = Math.max(4, side)
        const d = Math.max(4, side)

        const wallMat = new THREE.MeshStandardMaterial({ map: facadeTex, color: 0xf7f7f7 })
        const roofMatLocal = new THREE.MeshStandardMaterial({ color: 0x444444 })

        // simple compact building (no interior)
        const body = new THREE.Mesh(new THREE.BoxGeometry(w, 4, d), wallMat)
        body.position.y = 2
        root.add(body)

        const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.3, d + 0.6), roofMatLocal)
        roof.position.y = 4 + 0.15
        root.add(roof)

        // red cross sign on front wall (simple box)
        const crossMat = new THREE.MeshStandardMaterial({ color: 0xff3333, emissive: 0xff3333, emissiveIntensity: 0.6 })
        const cross = new THREE.Mesh(new THREE.BoxGeometry(Math.min(1.2, w * 0.4), Math.min(1.2, d * 0.4), 0.05), crossMat)
        cross.position.set(0, 2.6, d / 2 + 0.06)
        root.add(cross)

        // small entrance path
        const path = new THREE.Mesh(new THREE.BoxGeometry(Math.min(w, 4), 0.12, 3), new THREE.MeshStandardMaterial({ color: 0xd8d0c2 }))
        path.position.set(0, 0.06, d / 2 + 3.0)
        root.add(path)

        root.position.set(x, 0, z)
        root.traverse((o) => { if ((o as any).isMesh) { (o as any).castShadow = true; (o as any).receiveShadow = true } })
        return root
      }

      // instantiate medical post near social zone / dining
      const medNode = createMedicalPostAt(abkBaseBox.max.x + 20, sceneBox.min.z + 210, (input?.employeesCount as number) || 100)
      medNode.position.set(sceneBox.max.x - 200, 0.5, -25-(Math.sqrt(Math.max(20, ((input?.employeesCount as number) || 0) * 0.1)*100))/2)
      scene.add(medNode)

      // --- Hockey rink (ice box) ---
      function createHockeyRinkAt(x: number, z: number) {
        const root = new THREE.Group()
        root.name = 'hockeyRink'

        const rinkW = 34
        const rinkD = 16
        const boardH = 1.2
        const boardT = 0.25

        const iceMat = new THREE.MeshStandardMaterial({ color: 0xdfefff, roughness: 0.25, metalness: 0.0 })
        const ice = new THREE.Mesh(new THREE.BoxGeometry(rinkW, 0.18, rinkD), iceMat)
        ice.position.y = 0.09
        root.add(ice)

        const boardMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.0 })
        const glassMat = new THREE.MeshStandardMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.28 })
        const longBoard = new THREE.Mesh(new THREE.BoxGeometry(rinkW, boardH, boardT), boardMat)
        const shortBoard = new THREE.Mesh(new THREE.BoxGeometry(boardT, boardH, rinkD), boardMat)
        const longGlass = new THREE.Mesh(new THREE.BoxGeometry(rinkW, 0.55, 0.08), glassMat)
        const shortGlass = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, rinkD), glassMat)

        const boards = [
          { mesh: longBoard.clone(), x: 0, z: rinkD / 2 + boardT / 2 },
          { mesh: longBoard.clone(), x: 0, z: -rinkD / 2 - boardT / 2 },
          { mesh: shortBoard.clone(), x: rinkW / 2 + boardT / 2, z: 0 },
          { mesh: shortBoard.clone(), x: -rinkW / 2 - boardT / 2, z: 0 },
        ]
        boards.forEach((b) => {
          b.mesh.position.set(b.x, boardH / 2, b.z)
          root.add(b.mesh)
        })

        const glasses = [
          { mesh: longGlass.clone(), x: 0, z: rinkD / 2 + 0.08 },
          { mesh: longGlass.clone(), x: 0, z: -rinkD / 2 - 0.08 },
          { mesh: shortGlass.clone(), x: rinkW / 2 + 0.08, z: 0 },
          { mesh: shortGlass.clone(), x: -rinkW / 2 - 0.08, z: 0 },
        ]
        glasses.forEach((g) => {
          g.mesh.position.set(g.x, boardH + 0.2, g.z)
          root.add(g.mesh)
        })

        // red center line and blue goal lines
        const lineMat = new THREE.MeshStandardMaterial({ color: 0xd64b4b })
        const blueMat = new THREE.MeshStandardMaterial({ color: 0x2767c8 })
        const centerLine = new THREE.Mesh(new THREE.BoxGeometry(rinkW, 0.03, 0.35), lineMat)
        centerLine.position.set(0, 0.19, 0)
        root.add(centerLine)

        const goalLine1 = new THREE.Mesh(new THREE.BoxGeometry(rinkW, 0.03, 0.22), blueMat)
        goalLine1.position.set(0, 0.19, rinkD / 2 - 2.2)
        const goalLine2 = goalLine1.clone()
        goalLine2.position.set(0, 0.19, -rinkD / 2 + 2.2)
        root.add(goalLine1, goalLine2)

        // faceoff circles
        const faceoffCircle = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.08, 10, 40), new THREE.MeshStandardMaterial({ color: 0xd64b4b }))
        faceoffCircle.rotation.x = Math.PI / 2
        faceoffCircle.position.y = 0.2
        root.add(faceoffCircle)

        const blueCircle = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.06, 10, 32), new THREE.MeshStandardMaterial({ color: 0x2767c8 }))
        blueCircle.rotation.x = Math.PI / 2
        blueCircle.position.set(0, 0.2, 0)
        root.add(blueCircle)

        // goals
        const goalMat = new THREE.MeshStandardMaterial({ color: 0xffffff })
        for (const side of [-1, 1]) {
          const goal = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.6), goalMat)
          goal.position.set(0, 0.45, side * (rinkD / 2 + 0.42))
          root.add(goal)
        }

        // benches / penalty boxes
        const benchMat = new THREE.MeshStandardMaterial({ color: 0x7a5a3a })
        const bench1 = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.45, 1.0), benchMat)
        bench1.position.set(-rinkW / 2 - 3.0, 0.23, -2.0)
        const bench2 = bench1.clone()
        bench2.position.set(-rinkW / 2 - 3.0, 0.23, 2.0)
        root.add(bench1, bench2)

        // small end-area shelters
        const shelterMat = new THREE.MeshStandardMaterial({ color: 0x3f3f3f })
        const shelter = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.8, 1.6), shelterMat)
        shelter.position.set(rinkW / 2 + 2.6, 0.9, -3.8)
        const shelter2 = shelter.clone()
        shelter2.position.set(rinkW / 2 + 2.6, 0.9, 3.8)
        root.add(shelter, shelter2)

        root.position.set(x, 0, z)
        root.traverse((o) => { if ((o as any).isMesh) { (o as any).castShadow = true; (o as any).receiveShadow = true } })
        return root
      }

      const rinkPos = new THREE.Vector3(gymNode.position.x + 70, 0, gymNode.position.z + 18)
      const hockeyNode = createHockeyRinkAt(rinkPos.x, rinkPos.z)
      if (input?.sports.includes("Хоккейная коробка")) {
        scene.add(hockeyNode)
      }

      // параметры
      const innerR = radius*2, outerR = radius*2-8, height = 0.5, segments = 128;
      const halfH = height / 2;
      const positions = [];
      const indices = [];

      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const a = t * Math.PI * 2;
        const cos = Math.cos(a), sin = Math.sin(a);

        // верх: outer, inner
        positions.push(cos * outerR,  halfH, sin * outerR); // 0
        positions.push(cos * innerR,  halfH, sin * innerR); // 1

        // низ: outer, inner
        positions.push(cos * outerR, -halfH, sin * outerR); // 2
        positions.push(cos * innerR, -halfH, sin * innerR); // 3
      }

      // индексы
      for (let i = 0; i < segments; i++) {
        const b = i * 4;
        const n = b + 4;

        // верхняя поверхность
        indices.push(b + 0, n + 1, n + 0);
        indices.push(b + 0, b + 1, n + 1);

        // нижняя поверхность
        indices.push(b + 2, n + 2, n + 3);
        indices.push(b + 2, n + 3, b + 3);

        // наружная грань
        indices.push(b + 0, n + 2, n + 0);
        indices.push(b + 0, b + 2, n + 2);

        // внутренняя грань (реверс нормалей)
        indices.push(b + 1, n + 1, n + 3);
        indices.push(b + 1, n + 3, b + 3);
      }

      const geom = new THREE.BufferGeometry();
      geom.setIndex(indices);
      geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geom.computeVertexNormals();

      const mat = new THREE.MeshStandardMaterial({ color: 0x777777 });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(lakeGroupBox.getCenter(new THREE.Vector3(lakeGroupBox.max.x, 0, lakeGroupBox.max.z)).x, 0.5, -215)
      if (input?.landscaping.includes("Тропа здоровья")) {
        scene.add(mesh);
      }

      // Анимация волн: вызывать в основном animate() вашего приложения
      const clock = new THREE.Clock();
      function updateLake() {
        const t = clock.getElapsedTime();
        const pos = waterGeo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i);
          const z = pos.getZ(i);
          // простые синусоиды для волн
          const y = Math.sin((x + t * 2) * 0.1) * 0.4 + Math.cos((z - t * 1.5) * 0.12) * 0.3;
          pos.setY(i, y * 0.5); // амплитуда
        }
        pos.needsUpdate = true;
        waterGeo.computeVertexNormals(); // обновить нормали для корректного освещения
      }

      // В вашем основном цикле рендера:
      function animate() {
        requestAnimationFrame(animate);
        updateLake();             // <-- обновление волн
        renderer.render(scene, camera); // используйте вашу камеру
      }
      animate();

      // Small industrial annexes / warehouses near factory
      /*const annexMat = new THREE.MeshStandardMaterial({ color: 0x777777 })
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
      }*/

      // Grid helper for orientation
      //const grid = new THREE.GridHelper(600, 60, 0x444444, 0xaaaaaa)
      //scene.add(grid)
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
