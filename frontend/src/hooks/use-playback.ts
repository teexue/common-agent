import { useCallback, useEffect, useRef, useState } from "react"
import type { PlaybackSpeed } from "@/types/replay"

interface UsePlaybackReturn {
  currentIndex: number
  isPlaying: boolean
  speed: PlaybackSpeed
  play: () => void
  pause: () => void
  toggle: () => void
  stepForward: () => void
  stepBackward: () => void
  seekTo: (index: number) => void
  setSpeed: (speed: PlaybackSpeed) => void
  reset: () => void
  progress: number
}

export function usePlayback(totalCount: number): UsePlaybackReturn {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState<PlaybackSpeed>(10)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!isPlaying || totalCount === 0) {
      clearTimer()
      return
    }

    // At high speeds, batch events per frame (~60fps) instead of many small intervals
    if (speed > 5) {
      const eventsPerFrame = Math.max(1, Math.round(speed / 60))
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          const next = prev + eventsPerFrame
          if (next >= totalCount - 1) {
            setIsPlaying(false)
            return totalCount - 1
          }
          return next
        })
      }, 16)
    } else {
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= totalCount - 1) {
            setIsPlaying(false)
            return prev
          }
          return prev + 1
        })
      }, 1000 / speed)
    }

    return clearTimer
  }, [isPlaying, speed, totalCount, clearTimer])

  const play = useCallback(() => {
    if (currentIndex >= totalCount - 1) setCurrentIndex(0)
    setIsPlaying(true)
  }, [currentIndex, totalCount])

  const pause = useCallback(() => setIsPlaying(false), [])

  const toggle = useCallback(() => {
    if (isPlaying) pause()
    else play()
  }, [isPlaying, play, pause])

  const stepForward = useCallback(() => {
    setIsPlaying(false)
    setCurrentIndex((prev) => Math.min(prev + 1, totalCount - 1))
  }, [totalCount])

  const stepBackward = useCallback(() => {
    setIsPlaying(false)
    setCurrentIndex((prev) => Math.max(prev - 1, 0))
  }, [])

  const seekTo = useCallback((index: number) => {
    setIsPlaying(false)
    setCurrentIndex(Math.max(0, Math.min(index, totalCount - 1)))
  }, [totalCount])

  const reset = useCallback(() => {
    setIsPlaying(false)
    setCurrentIndex(0)
  }, [])

  const progress = totalCount > 1 ? currentIndex / (totalCount - 1) : 0

  return {
    currentIndex,
    isPlaying,
    speed,
    play,
    pause,
    toggle,
    stepForward,
    stepBackward,
    seekTo,
    setSpeed,
    reset,
    progress,
  }
}
