import "./style.css"
import Canvas from "./canvas"
import Scroll from "./scroll"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { $, $$ } from "./utils/dom"

gsap.registerPlugin(ScrollTrigger)

class App {
  canvas: Canvas
  scroll: Scroll

  constructor() {
    this.scroll = new Scroll()
    this.canvas = new Canvas({ scroll: this.scroll })

    this.setupModeSwitcher()

    this.render()
  }

  setupModeSwitcher() {
    const btnMagazine = document.getElementById("btn-magazine")
    const btnVortex = document.getElementById("btn-vortex")
    const btnSpotify = document.getElementById("btn-spotify")

    const buttons: Record<string, HTMLElement | null> = {
      magazine: btnMagazine,
      vortex: btnVortex,
      spotify: btnSpotify,
    }

    const activeClasses = ["bg-amber-50", "text-neutral-950", "shadow-sm"]
    const inactiveClasses = ["text-neutral-400", "hover:text-neutral-200", "hover:bg-neutral-800/50"]

    const setActive = (mode: "magazine" | "vortex" | "spotify") => {
      Object.entries(buttons).forEach(([key, btn]) => {
        if (!btn) return
        if (key === mode) {
          btn.classList.add(...activeClasses)
          btn.classList.remove(...inactiveClasses)
        } else {
          btn.classList.add(...inactiveClasses)
          btn.classList.remove(...activeClasses)
        }
      })

      this.canvas.switchMode(mode)
    }

    btnMagazine?.addEventListener("click", () => setActive("magazine"))
    btnVortex?.addEventListener("click", () => setActive("vortex"))
    btnSpotify?.addEventListener("click", () => setActive("spotify"))
  }

  render() {
    this.canvas.render()
    requestAnimationFrame(this.render.bind(this))
  }
}

export default new App()
