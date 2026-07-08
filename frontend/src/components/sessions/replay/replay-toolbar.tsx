import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { PlaybackSpeed } from "@/types/replay"

interface ReplayToolbarProps {
  isPlaying: boolean
  currentIndex: number
  totalCount: number
  speed: PlaybackSpeed
  progress: number
  onToggle: () => void
  onStepBack: () => void
  onStepForward: () => void
  onReset: () => void
  onSpeedChange: (speed: PlaybackSpeed) => void
  onSeekProgress: (ratio: number) => void
}

const SPEEDS: PlaybackSpeed[] = [0.5, 1, 2, 10, 20]

export function ReplayToolbar({
  isPlaying,
  currentIndex,
  totalCount,
  speed,
  progress,
  onToggle,
  onStepBack,
  onStepForward,
  onReset,
  onSpeedChange,
  onSeekProgress,
}: ReplayToolbarProps) {
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    onSeekProgress(Math.max(0, Math.min(1, ratio)))
  }

  return (
    <div className="flex items-center gap-2 border-b border-border px-3 py-2">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onReset}
        title="重置"
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onStepBack}
        title="后退"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Button
        variant="default"
        size="icon"
        className="h-7 w-7"
        onClick={onToggle}
        title={isPlaying ? "暂停" : "播放"}
      >
        {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onStepForward}
        title="前进"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      <div className="mx-1 h-4 w-px bg-border" />

      <div className="flex items-center gap-1">
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => onSpeedChange(s)}
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-mono transition-colors",
              speed === s
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {s}x
          </button>
        ))}
      </div>

      <div className="mx-1 h-4 w-px bg-border" />

      <div
        className="group relative flex h-1.5 flex-1 cursor-pointer items-center"
        onClick={handleProgressClick}
      >
        <div className="h-full w-full rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      <span className="min-w-[4rem] text-right font-mono text-[10px] text-muted-foreground">
        {currentIndex + 1} / {totalCount}
      </span>
    </div>
  )
}
