import * as THREE from "three"
import gsap from "gsap"
import vertexShader from "./shaders/vortex-vertex.glsl"
import fragmentShader from "./shaders/vortex-fragment.glsl"
import centerVertexShader from "./shaders/vortex-center-vertex.glsl"
import centerFragmentShader from "./shaders/vortex-center-fragment.glsl"

interface Props {
  scene: THREE.Scene
  cameraZ?: number
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

export default class VortexGallery {
  scene: THREE.Scene
  group: THREE.Group
  instancedMaterial: THREE.ShaderMaterial | null = null
  instancedMesh: THREE.InstancedMesh | null = null
  centerMaterial: THREE.ShaderMaterial | null = null
  centerMesh: THREE.Mesh | null = null
  imageInfos: ImageInfo[] = []
  atlasTexture: THREE.Texture | null = null
  cameraZ: number
  textureIndex: number = 0
  isVisible: boolean = true

  scrollY: {
    speedTarget: number
    speedCurrent: number
    target: number
    current: number
    direction: number
  }

  constructor({ scene, cameraZ = 6 }: Props) {
    this.scene = scene
    this.cameraZ = cameraZ
    this.group = new THREE.Group()
    this.scene.add(this.group)

    this.scrollY = {
      speedTarget: 0,
      speedCurrent: 0,
      target: 0,
      current: 0,
      direction: 1,
    }

    this.loadTextureAtlas().then(() => {
      this.createInstancedMesh()
      this.createCenteredMesh()
      this.setVisible(this.isVisible)
    })
  }

  async loadTextureAtlas() {
    const imagePaths = [
      "/512/p1.jpg",
      "/512/p2.jpg",
      "/512/p3.jpg",
      "/512/p4.jpg",
      "/512/p5.jpg",
      "/512/p6.jpg",
      "/512/p7.jpg",
      "/512/p8.jpg",
      "/512/p9.jpg",
      "/512/p10.jpg",
      "/512/p11.jpg",
      "/512/p12.jpg",
      "/512/p13.jpg",
    ]

    const imagePromises = imagePaths.map((path) => {
      return new Promise<HTMLImageElement>((resolve) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () => resolve(img)
        img.src = path
      })
    })

    const images = await Promise.all(imagePromises)

    const atlasWidth = Math.max(...images.map((img) => img.width || 512))
    let totalHeight = 0

    images.forEach((img) => {
      totalHeight += img.height || 512
    })

    const canvas = document.createElement("canvas")
    canvas.width = atlasWidth || 512
    canvas.height = totalHeight || 6656
    const ctx = canvas.getContext("2d")!

    let currentY = 0
    this.imageInfos = images.map((img) => {
      const w = img.width || 512
      const h = img.height || 512
      const aspectRatio = w / h

      ctx.drawImage(img, 0, currentY)

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
    this.atlasTexture.needsUpdate = true
  }

  createInstancedMesh() {
    if (!this.atlasTexture || this.imageInfos.length === 0) return

    const geometry = new THREE.BoxGeometry(1.5, 1.5, 0.075)
    const RADIUS = 6
    const HEIGHT = 120
    const COUNT = 400

    this.instancedMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      precision: "highp",
      transparent: true,
      uniforms: {
        uTime: new THREE.Uniform(0),
        uAtlas: new THREE.Uniform(this.atlasTexture),
        uScrollY: new THREE.Uniform(this.scrollY.current),
        uZrange: new THREE.Uniform(HEIGHT),
        uMaxZ: new THREE.Uniform(HEIGHT * 0.5),
        uSpeedY: new THREE.Uniform(0),
        uDirection: new THREE.Uniform(this.scrollY.direction),
      },
    })

    this.instancedMesh = new THREE.InstancedMesh(
      geometry,
      this.instancedMaterial,
      COUNT
    )

    const aAngles = new Float32Array(COUNT)
    const aHeights = new Float32Array(COUNT)
    const aRadiuses = new Float32Array(COUNT)
    const aAspectRatios = new Float32Array(COUNT)
    const aSpeeds = new Float32Array(COUNT)
    const aImagesRes = new Float32Array(COUNT * 2)
    const aTextureCoords = new Float32Array(COUNT * 4)

    const CIRCLE_COUNT = HEIGHT / 3
    const CIRCLE_HEIGHT = HEIGHT / CIRCLE_COUNT
    const speeds = new Float32Array(CIRCLE_COUNT)

    for (let j = 0; j < CIRCLE_COUNT; j++) {
      speeds[j] = Math.random() * 0.2 + 0.8
    }

    for (let i = 0; i < COUNT; i++) {
      const angle = (i / COUNT) * Math.PI * 2
      const imageIndex = Math.floor(Math.random() * this.imageInfos.length)

      aTextureCoords[i * 4 + 0] = this.imageInfos[imageIndex].uvs.xStart
      aTextureCoords[i * 4 + 1] = this.imageInfos[imageIndex].uvs.xEnd
      aTextureCoords[i * 4 + 2] = this.imageInfos[imageIndex].uvs.yStart
      aTextureCoords[i * 4 + 3] = this.imageInfos[imageIndex].uvs.yEnd

      aImagesRes[i * 2 + 0] = this.imageInfos[imageIndex].width
      aImagesRes[i * 2 + 1] = this.imageInfos[imageIndex].height

      aAngles[i] = angle
      aHeights[i] = (i % CIRCLE_COUNT) * CIRCLE_HEIGHT - HEIGHT / 2
      aRadiuses[i] = RADIUS
      aAspectRatios[i] = this.imageInfos[imageIndex].aspectRatio
      aSpeeds[i] = speeds[i % CIRCLE_COUNT]
    }

    this.instancedMesh.geometry.setAttribute(
      "aAngle",
      new THREE.InstancedBufferAttribute(aAngles, 1)
    )
    this.instancedMesh.geometry.setAttribute(
      "aHeight",
      new THREE.InstancedBufferAttribute(aHeights, 1)
    )
    this.instancedMesh.geometry.setAttribute(
      "aRadius",
      new THREE.InstancedBufferAttribute(aRadiuses, 1)
    )
    this.instancedMesh.geometry.setAttribute(
      "aAspectRatio",
      new THREE.InstancedBufferAttribute(aAspectRatios, 1)
    )
    this.instancedMesh.geometry.setAttribute(
      "aSpeed",
      new THREE.InstancedBufferAttribute(aSpeeds, 1)
    )
    this.instancedMesh.geometry.setAttribute(
      "aTextureCoords",
      new THREE.InstancedBufferAttribute(aTextureCoords, 4)
    )
    this.instancedMesh.geometry.setAttribute(
      "aImageRes",
      new THREE.InstancedBufferAttribute(aImagesRes, 2)
    )

    this.group.add(this.instancedMesh)
  }

  createCenteredMesh() {
    if (!this.atlasTexture || this.imageInfos.length === 0) return

    const geometry = new THREE.PlaneGeometry(1.7, 2.3)
    const initialUVs = this.imageInfos[this.textureIndex].uvs

    this.centerMaterial = new THREE.ShaderMaterial({
      vertexShader: centerVertexShader,
      fragmentShader: centerFragmentShader,
      transparent: true,
      uniforms: {
        uAtlas: new THREE.Uniform(this.atlasTexture),
        uTextureCoords: new THREE.Uniform(
          new THREE.Vector4(
            initialUVs.xStart,
            initialUVs.xEnd,
            initialUVs.yStart,
            initialUVs.yEnd
          )
        ),
      },
    })

    this.centerMesh = new THREE.Mesh(geometry, this.centerMaterial)
    this.group.add(this.centerMesh)
  }

  setVisible(visible: boolean) {
    this.isVisible = visible
    this.group.visible = visible
  }

  render(time: number = 0) {
    if (!this.isVisible) return

    if (this.instancedMaterial && this.centerMaterial && this.imageInfos.length > 0) {
      this.instancedMaterial.uniforms.uTime.value = time

      // Autoplay scroll progression
      const autoSpeed = 0.015
      this.scrollY.target += autoSpeed * this.scrollY.direction
      this.scrollY.speedTarget += autoSpeed * this.scrollY.direction

      const totalImages = this.imageInfos.length
      this.textureIndex = Math.abs(
        Math.floor(this.scrollY.speedTarget % (totalImages - 1))
      ) % totalImages

      const currentUVs = this.imageInfos[this.textureIndex].uvs
      this.centerMaterial.uniforms.uTextureCoords.value.set(
        currentUVs.xStart,
        currentUVs.xEnd,
        currentUVs.yStart,
        currentUVs.yEnd
      )

      this.scrollY.current = gsap.utils.interpolate(
        this.scrollY.current,
        this.scrollY.target,
        0.1
      )
      this.scrollY.speedCurrent = gsap.utils.interpolate(
        this.scrollY.speedCurrent,
        this.scrollY.speedTarget,
        0.1
      )

      this.instancedMaterial.uniforms.uScrollY.value = this.scrollY.current
      this.instancedMaterial.uniforms.uSpeedY.value = this.scrollY.speedCurrent
      this.instancedMaterial.uniforms.uDirection.value = this.scrollY.direction
    }
  }
}
