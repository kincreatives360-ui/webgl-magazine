import * as THREE from "three"
import gsap from "gsap"
import vertexShader from "./shaders/spotify-vertex.glsl"
import fragmentShader from "./shaders/spotify-fragment.glsl"

interface Props {
  scene: THREE.Scene
  sizes?: {
    width: number
    height: number
  }
}

interface ImageInfo {
  width: number
  height: number
  aspectRatio: number
  uvs: {
    xStart: number
    xEnd: number
    yStart: number
    yEnd: number
  }
}

export default class SpotifyVisualiser {
  scene: THREE.Scene
  group: THREE.Group
  geometry: THREE.PlaneGeometry
  material: THREE.ShaderMaterial
  mesh: THREE.InstancedMesh | null = null
  meshCount: number = 250
  imageInfos: ImageInfo[] = []
  atlasTexture: THREE.Texture | null = null
  blurryAtlasTexture: THREE.Texture | null = null
  isVisible: boolean = true

  shaderParameters = {
    maxX: 12,
    maxY: 8,
  }

  scrollY = {
    target: 0,
    current: 0,
  }

  drag = {
    xTarget: 0,
    xCurrent: 0,
    yTarget: 0,
    yCurrent: 0,
  }

  dragDamping = 0.08

  constructor({ scene }: Props) {
    this.scene = scene
    this.group = new THREE.Group()
    this.scene.add(this.group)

    // 628 x 1070 aspect ratio (width 1.0, height 1.703)
    this.geometry = new THREE.PlaneGeometry(1, 1.703)

    this.createMaterial()
    this.createInstancedMesh()

    const urls = new Array(30)
      .fill(0)
      .map((_, i) => `/covers/image_${i}.jpg`)

    this.loadTextureAtlas(urls).then(() => {
      this.createBlurryAtlas()
      this.fillMeshData()
      this.setVisible(this.isVisible)
    })
  }

  async loadTextureAtlas(urls: string[]) {
    const imagePromises = urls.map(async (path) => {
      return await new Promise<CanvasImageSource>((resolve) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () => resolve(img)
        img.src = path
      })
    })

    const images = await Promise.all(imagePromises)

    const atlasWidth = Math.max(
      ...images.map((img: any) => (img.width as number) || 512)
    )
    let totalHeight = 0

    images.forEach((img: any) => {
      totalHeight += (img.height as number) || 512
    })

    const canvas = document.createElement("canvas")
    canvas.width = atlasWidth || 512
    canvas.height = totalHeight || 15360
    const ctx = canvas.getContext("2d")!

    let currentY = 0
    this.imageInfos = images.map((img: any) => {
      const w = (img.width as number) || 512
      const h = (img.height as number) || 512
      const aspectRatio = w / h

      ctx.drawImage(img as any, 0, currentY)

      const info = {
        width: w,
        height: h,
        aspectRatio,
        uvs: {
          xStart: 0,
          xEnd: w / canvas.width,
          yStart: 1 - currentY / canvas.height,
          yEnd: 1 - (currentY + h) / canvas.height,
        },
      }

      currentY += h
      return info
    })

    this.atlasTexture = new THREE.Texture(canvas)
    this.atlasTexture.wrapS = THREE.ClampToEdgeWrapping
    this.atlasTexture.wrapT = THREE.ClampToEdgeWrapping
    this.atlasTexture.minFilter = THREE.LinearFilter
    this.atlasTexture.magFilter = THREE.LinearFilter
    this.atlasTexture.needsUpdate = true

    this.material.uniforms.uAtlas.value = this.atlasTexture
  }

  createBlurryAtlas() {
    if (!this.atlasTexture) return
    const blurryCanvas = document.createElement("canvas")
    blurryCanvas.width = this.atlasTexture.image.width || 512
    blurryCanvas.height = this.atlasTexture.image.height || 15360
    const ctx = blurryCanvas.getContext("2d")!
    ctx.filter = "blur(80px)"
    ctx.drawImage(this.atlasTexture.image, 0, 0)

    this.blurryAtlasTexture = new THREE.Texture(blurryCanvas)
    this.blurryAtlasTexture.wrapS = THREE.ClampToEdgeWrapping
    this.blurryAtlasTexture.wrapT = THREE.ClampToEdgeWrapping
    this.blurryAtlasTexture.minFilter = THREE.LinearFilter
    this.blurryAtlasTexture.magFilter = THREE.LinearFilter
    this.blurryAtlasTexture.needsUpdate = true

    this.material.uniforms.uBlurryAtlas.value = this.blurryAtlasTexture
  }

  createMaterial() {
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        uMaxXdisplacement: {
          value: new THREE.Vector2(
            this.shaderParameters.maxX,
            this.shaderParameters.maxY
          ),
        },
        uWrapperTexture: {
          value: new THREE.TextureLoader().load("/spt-3.png", (tex) => {
            tex.minFilter = THREE.NearestFilter
            tex.magFilter = THREE.NearestFilter
            tex.generateMipmaps = false
            tex.needsUpdate = true
          }),
        },
        uAtlas: new THREE.Uniform(null),
        uBlurryAtlas: new THREE.Uniform(null),
        uScrollY: { value: 0 },
        uSpeedY: { value: 0 },
        uDrag: { value: new THREE.Vector2(0, 0) },
      },
    })
  }

  createInstancedMesh() {
    this.mesh = new THREE.InstancedMesh(
      this.geometry,
      this.material,
      this.meshCount
    )
    this.group.add(this.mesh)
  }

  fillMeshData() {
    if (!this.mesh || this.imageInfos.length === 0) return

    const initialPosition = new Float32Array(this.meshCount * 3)
    const meshSpeed = new Float32Array(this.meshCount)
    const aTextureCoords = new Float32Array(this.meshCount * 4)

    for (let i = 0; i < this.meshCount; i++) {
      initialPosition[i * 3 + 0] =
        (Math.random() - 0.5) * this.shaderParameters.maxX * 2
      initialPosition[i * 3 + 1] =
        (Math.random() - 0.5) * this.shaderParameters.maxY * 2
      initialPosition[i * 3 + 2] = Math.random() * (7 - -30) - 30
      meshSpeed[i] = Math.random() * 0.5 + 0.5

      const imageIndex = i % this.imageInfos.length
      aTextureCoords[i * 4 + 0] = this.imageInfos[imageIndex].uvs.xStart
      aTextureCoords[i * 4 + 1] = this.imageInfos[imageIndex].uvs.xEnd
      aTextureCoords[i * 4 + 2] = this.imageInfos[imageIndex].uvs.yStart
      aTextureCoords[i * 4 + 3] = this.imageInfos[imageIndex].uvs.yEnd
    }

    this.geometry.setAttribute(
      "aInitialPosition",
      new THREE.InstancedBufferAttribute(initialPosition, 3)
    )
    this.geometry.setAttribute(
      "aMeshSpeed",
      new THREE.InstancedBufferAttribute(meshSpeed, 1)
    )
    this.mesh.geometry.setAttribute(
      "aTextureCoords",
      new THREE.InstancedBufferAttribute(aTextureCoords, 4)
    )
  }

  setVisible(visible: boolean) {
    this.isVisible = visible
    this.group.visible = visible
  }

  render(delta: number = 0.016) {
    if (!this.isVisible || !this.material) return

    // Autoplay progression along ALL axes (X, Y, Z)
    this.material.uniforms.uTime.value += delta * 0.5

    // Z-axis forward movement
    this.scrollY.target += 0.02
    
    // X & Y axis floating movement
    this.drag.xTarget += 0.008
    this.drag.yTarget += Math.sin(this.material.uniforms.uTime.value * 2.0) * 0.005 + 0.004

    // Eased interpolation towards targets
    this.drag.xCurrent += (this.drag.xTarget - this.drag.xCurrent) * this.dragDamping
    this.drag.yCurrent += (this.drag.yTarget - this.drag.yCurrent) * this.dragDamping

    this.material.uniforms.uDrag.value.set(
      this.drag.xCurrent,
      this.drag.yCurrent
    )

    this.scrollY.current = gsap.utils.interpolate(
      this.scrollY.current,
      this.scrollY.target,
      0.12
    )

    this.material.uniforms.uScrollY.value = this.scrollY.current
  }
}
