"use client"

import { Landmark, Sunrise, TreePine, UtensilsCrossed } from "lucide-react"
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion"

import { Badge } from "@/components/ui/badge"

const itineraryRows = [
  {
    time: "Morning",
    title: "Fushimi Inari Shrine",
    icon: Sunrise,
  },
  {
    time: "Afternoon",
    title: "Arashiyama Bamboo Grove",
    icon: TreePine,
  },
  {
    time: "Evening",
    title: "Pontocho food crawl",
    icon: UtensilsCrossed,
  },
]

export function HeroMockupCard() {
  const prefersReducedMotion = useReducedMotion()

  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [5, -5]), {
    stiffness: 150,
    damping: 20,
  })
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-5, 5]), {
    stiffness: 150,
    damping: 20,
  })

  function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    if (prefersReducedMotion) return
    const rect = event.currentTarget.getBoundingClientRect()
    mouseX.set((event.clientX - rect.left) / rect.width - 0.5)
    mouseY.set((event.clientY - rect.top) / rect.height - 0.5)
  }

  function handleMouseLeave() {
    mouseX.set(0)
    mouseY.set(0)
  }

  return (
    <div className="w-full max-w-sm [perspective:800px]">
      <motion.div
        className="relative w-full"
        animate={{ y: [0, -8, 0], rotate: [-0.6, 0.6, -0.6] }}
        transition={{
          duration: 7,
          repeat: Infinity,
          repeatType: "mirror",
          ease: "easeInOut",
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Separate layer purely for the mouse-driven 3D tilt — keeping it
            off the ambient-loop element above avoids Framer having to
            reconcile an `animate` target and an externally-driven `style`
            motion value for the same transform on one component. */}
        <motion.div
          className="relative"
          style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        >
          <motion.div
            aria-hidden="true"
            className="absolute inset-4 -z-10 rounded-full bg-primary/20 blur-2xl"
            animate={{ opacity: [0.35, 0.6, 0.35], scale: [1, 1.08, 1] }}
            transition={{
              duration: 6,
              repeat: Infinity,
              repeatType: "mirror",
              ease: "easeInOut",
            }}
          />
          <div className="rounded-2xl border border-border bg-card p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                Day 2 · Kyoto
              </span>
              <Badge variant="secondary">
                <Landmark aria-hidden="true" />
                ¥18,400 today
              </Badge>
            </div>
            <div className="space-y-4">
              {itineraryRows.map((row) => (
                <div key={row.title} className="flex items-center gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <row.icon
                      aria-hidden="true"
                      className="size-4 text-primary"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {row.time}
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {row.title}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
