"use client"

import { useEffect, useRef } from "react"

interface Star {
  x: number
  y: number
  size: number
  alpha: number
  twinkleSpeed: number
  twinklePhase: number
  speedX: number
  speedY: number
}

interface ShootingStar {
  x: number
  y: number
  length: number
  speed: number
  angle: number
  alpha: number
  life: number
}

export function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animationId: number
    const stars: Star[] = []
    const shootingStars: ShootingStar[] = []
    const starCount = 180

    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    const createStar = (): Star => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2.5 + 0.5,
      alpha: Math.random() * 0.6 + 0.2,
      twinkleSpeed: Math.random() * 0.02 + 0.005,
      twinklePhase: Math.random() * Math.PI * 2,
      speedX: (Math.random() - 0.5) * 0.15,
      speedY: (Math.random() - 0.5) * 0.1 + 0.05,
    })

    const createShootingStar = (): ShootingStar => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 0.5,
      length: Math.random() * 80 + 40,
      speed: Math.random() * 8 + 6,
      angle: Math.PI / 4 + (Math.random() - 0.5) * 0.3,
      alpha: 1,
      life: 1,
    })

    const initStars = () => {
      stars.length = 0
      for (let i = 0; i < starCount; i++) {
        stars.push(createStar())
      }
    }

    let time = 0
    let shootingStarTimer = 0

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      time += 0.016
      shootingStarTimer += 0.016

      // Occasionally add shooting stars
      if (shootingStarTimer > 3 + Math.random() * 4) {
        shootingStars.push(createShootingStar())
        shootingStarTimer = 0
      }

      // Animate and draw stars
      stars.forEach((star) => {
        // Move stars slowly
        star.x += star.speedX
        star.y += star.speedY

        // Wrap around screen
        if (star.x < 0) star.x = canvas.width
        if (star.x > canvas.width) star.x = 0
        if (star.y < 0) star.y = canvas.height
        if (star.y > canvas.height) star.y = 0

        const twinkle = Math.sin(time * star.twinkleSpeed * 60 + star.twinklePhase) * 0.5 + 0.5
        const currentAlpha = star.alpha * (0.4 + twinkle * 0.6)

        // Draw star glow
        const gradient = ctx.createRadialGradient(
          star.x, star.y, 0,
          star.x, star.y, star.size * 3
        )
        gradient.addColorStop(0, `rgba(200, 240, 220, ${currentAlpha})`)
        gradient.addColorStop(0.5, `rgba(150, 220, 200, ${currentAlpha * 0.3})`)
        gradient.addColorStop(1, `rgba(100, 200, 180, 0)`)

        ctx.beginPath()
        ctx.arc(star.x, star.y, star.size * 3, 0, Math.PI * 2)
        ctx.fillStyle = gradient
        ctx.fill()

        // Draw star core
        ctx.beginPath()
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 255, 255, ${currentAlpha})`
        ctx.fill()
      })

      // Animate shooting stars
      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const ss = shootingStars[i]
        
        // Move shooting star
        ss.x += Math.cos(ss.angle) * ss.speed
        ss.y += Math.sin(ss.angle) * ss.speed
        ss.life -= 0.015
        ss.alpha = ss.life

        if (ss.life <= 0 || ss.x > canvas.width || ss.y > canvas.height) {
          shootingStars.splice(i, 1)
          continue
        }

        // Draw shooting star trail
        const tailX = ss.x - Math.cos(ss.angle) * ss.length
        const tailY = ss.y - Math.sin(ss.angle) * ss.length

        const gradient = ctx.createLinearGradient(tailX, tailY, ss.x, ss.y)
        gradient.addColorStop(0, `rgba(100, 200, 180, 0)`)
        gradient.addColorStop(0.8, `rgba(150, 220, 200, ${ss.alpha * 0.5})`)
        gradient.addColorStop(1, `rgba(255, 255, 255, ${ss.alpha})`)

        ctx.beginPath()
        ctx.moveTo(tailX, tailY)
        ctx.lineTo(ss.x, ss.y)
        ctx.strokeStyle = gradient
        ctx.lineWidth = 2
        ctx.stroke()

        // Draw head glow
        ctx.beginPath()
        ctx.arc(ss.x, ss.y, 3, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 255, 255, ${ss.alpha})`
        ctx.fill()
      }

      // Draw subtle moving nebula clouds
      ctx.save()
      ctx.globalAlpha = 0.02
      const nebulaX = (Math.sin(time * 0.1) * 50) + canvas.width * 0.3
      const nebulaY = (Math.cos(time * 0.08) * 30) + canvas.height * 0.4
      const nebulaGradient = ctx.createRadialGradient(nebulaX, nebulaY, 0, nebulaX, nebulaY, 300)
      nebulaGradient.addColorStop(0, "rgba(100, 200, 180, 1)")
      nebulaGradient.addColorStop(0.5, "rgba(50, 150, 130, 0.5)")
      nebulaGradient.addColorStop(1, "rgba(30, 100, 80, 0)")
      ctx.fillStyle = nebulaGradient
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.restore()

      // Draw moving diagonal light rays
      ctx.save()
      ctx.globalAlpha = 0.025
      for (let i = 0; i < 3; i++) {
        const baseX = canvas.width * (0.2 + i * 0.3)
        const x = baseX + Math.sin(time * 0.2 + i) * 30
        const gradient = ctx.createLinearGradient(x, 0, x + 200, canvas.height)
        gradient.addColorStop(0, "rgba(100, 200, 180, 0)")
        gradient.addColorStop(0.5, "rgba(100, 200, 180, 1)")
        gradient.addColorStop(1, "rgba(100, 200, 180, 0)")
        ctx.fillStyle = gradient
        ctx.fillRect(x, 0, 2, canvas.height)
      }
      ctx.restore()

      animationId = requestAnimationFrame(animate)
    }

    resizeCanvas()
    initStars()
    animate()

    const handleResize = () => {
      resizeCanvas()
      initStars()
    }

    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
      cancelAnimationFrame(animationId)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
    />
  )
}
