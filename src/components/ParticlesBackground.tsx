import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  alpha: number
}

interface Props {
  /** Particle count at 1280px wide; scales with viewport area. */
  density?: number
  /** Draw lines between nearby particles. */
  connect?: boolean
  className?: string
}

const LINK_DISTANCE = 130

/**
 * Canvas particle field used behind hero sections. Colors are read from the
 * live CSS custom properties (--primary / --chart-2) so it follows the
 * platform theme and switches with light/dark mode automatically.
 */
export function ParticlesBackground({ density = 55, connect = true, className = '' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Respect users who asked the OS to reduce motion — render a static field.
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let width = 0
    let height = 0
    let particles: Particle[] = []
    let frame = 0
    let dpr = 1

    function readThemeColors() {
      const styles = getComputedStyle(document.documentElement)
      const isDark = document.documentElement.classList.contains('dark')
      return {
        primary: styles.getPropertyValue('--primary').trim() || '#F2CD5C',
        // Dark mode's connecting lines stay warm (chart-3); light mode uses a
        // faint navy instead of an olive-gold tint, so the constellation reads
        // as a crisp neutral accent rather than adding more yellow haze.
        accent: isDark
          ? (styles.getPropertyValue('--chart-3').trim() || '#7C7550')
          : (styles.getPropertyValue('--foreground').trim() || '#0A1B33'),
        dotAlpha: isDark ? 1 : 1.1,
        linkAlpha: isDark ? 0.18 : 0.12,
        dotScale: isDark ? 1 : 1.05,
      }
    }
    let colors = readThemeColors()

    function seed() {
      const area = width * height
      const count = Math.round(density * (area / (1280 * 720)))
      particles = Array.from({ length: Math.max(18, Math.min(110, count)) }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.32,
        vy: (Math.random() - 0.5) * 0.32,
        radius: Math.random() * 2 + 1,
        alpha: Math.random() * 0.4 + 0.25,
      }))
    }

    function resize() {
      const parent = canvas.parentElement
      if (!parent) return
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = parent.offsetWidth
      height = parent.offsetHeight
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      seed()
    }

    function draw() {
      ctx.clearRect(0, 0, width, height)

      if (connect) {
        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x
            const dy = particles[i].y - particles[j].y
            const dist = Math.hypot(dx, dy)
            if (dist < LINK_DISTANCE) {
              ctx.globalAlpha = (1 - dist / LINK_DISTANCE) * colors.linkAlpha
              ctx.strokeStyle = colors.accent
              ctx.lineWidth = 1.1
              ctx.beginPath()
              ctx.moveTo(particles[i].x, particles[i].y)
              ctx.lineTo(particles[j].x, particles[j].y)
              ctx.stroke()
            }
          }
        }
      }

      for (const p of particles) {
        ctx.globalAlpha = Math.min(1, p.alpha * colors.dotAlpha)
        ctx.fillStyle = colors.primary
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius * colors.dotScale, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    function step() {
      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        // Wrap around the edges so the field never looks like it's draining.
        if (p.x < -10) p.x = width + 10
        if (p.x > width + 10) p.x = -10
        if (p.y < -10) p.y = height + 10
        if (p.y > height + 10) p.y = -10
      }
      draw()
      frame = requestAnimationFrame(step)
    }

    resize()
    if (reduceMotion) draw()
    else frame = requestAnimationFrame(step)

    const resizeObserver = new ResizeObserver(resize)
    if (canvas.parentElement) resizeObserver.observe(canvas.parentElement)

    // Re-read colors when the theme class flips on <html>.
    const themeObserver = new MutationObserver(() => {
      colors = readThemeColors()
      if (reduceMotion) draw()
    })
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      themeObserver.disconnect()
    }
  }, [density, connect])

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`} aria-hidden="true">
      {/* Moving theme-colored gradient wash under the particles. Kept faint in
          light mode on purpose — this used to run at 32%/18% opacity, strong
          enough to tint the whole hero yellow and fight with body text. */}
      <div className="absolute inset-0 animate-gradient-shift bg-[length:200%_200%] bg-[linear-gradient(120deg,color-mix(in_srgb,var(--primary)_7%,transparent),transparent_38%,color-mix(in_srgb,var(--chart-3)_6%,transparent)_68%,transparent)] dark:bg-[linear-gradient(120deg,color-mix(in_srgb,var(--primary)_18%,transparent),transparent_40%,color-mix(in_srgb,var(--chart-2)_20%,transparent)_70%,transparent)]" />
      {/* Soft radial bloom adds depth so the hero doesn't read as flat colour */}
      <div className="absolute inset-0 bg-[radial-gradient(60%_55%_at_50%_35%,color-mix(in_srgb,var(--primary)_5%,transparent),transparent_70%)] dark:bg-[radial-gradient(60%_55%_at_50%_35%,color-mix(in_srgb,var(--primary)_12%,transparent),transparent_70%)]" />
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  )
}
