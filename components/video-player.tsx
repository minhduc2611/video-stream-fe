"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  Subtitles,
  SkipBack,
  SkipForward,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Hls from "hls.js"

interface VideoPlayerProps {
  src: string
  title?: string
  subtitles?: Array<{
    label: string
    src: string
    language: string
  }>
  className?: string
}

export default function VideoPlayer({ src, title, subtitles = [], className }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [quality, setQuality] = useState("auto")
  const [selectedSubtitle, setSelectedSubtitle] = useState("off")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [availableQualities, setAvailableQualities] = useState<string[]>([])

  // Auto-hide controls
  useEffect(() => {
    let timeout: NodeJS.Timeout
    if (showControls && isPlaying) {
      timeout = setTimeout(() => setShowControls(false), 3000)
    }
    return () => clearTimeout(timeout)
  }, [showControls, isPlaying])

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleLoadedMetadata = () => {
      setDuration(video.duration)
      setIsLoading(false)
    }

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime)
    }

    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)

    video.addEventListener("loadedmetadata", handleLoadedMetadata)
    video.addEventListener("timeupdate", handleTimeUpdate)
    video.addEventListener("play", handlePlay)
    video.addEventListener("pause", handlePause)

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata)
      video.removeEventListener("timeupdate", handleTimeUpdate)
      video.removeEventListener("play", handlePlay)
      video.removeEventListener("pause", handlePause)
    }
  }, [])

  // HLS support with hls.js
  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return

    // Clean up previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    setIsLoading(true)
    setError("")

    if (src.includes(".m3u8")) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
        })
        
        hlsRef.current = hls
        
        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
          console.log("HLS media attached")
        })
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log("HLS manifest parsed")
          setIsLoading(false)
          
          // Get available quality levels
          const levels = hls.levels
          const qualities = levels.map((level, index) => ({
            height: level.height,
            index: index,
            label: `${level.height}p`
          }))
          
          // Sort by height (highest first)
          qualities.sort((a, b) => b.height - a.height)
          
          const qualityLabels = ["auto", ...qualities.map(q => q.label)]
          setAvailableQualities(qualityLabels)
          
          console.log("Available qualities:", qualityLabels)
        })
        
        hls.on(Hls.Events.LEVEL_SWITCHED, (event: any, data: any) => {
          console.log("Quality switched to level:", data.level)
          const currentLevel = hls.levels[data.level]
          if (currentLevel) {
            console.log(`Now playing at ${currentLevel.height}p`)
          }
        })
        
        hls.loadSource(src)
        hls.attachMedia(video)
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // Native HLS support (Safari)
        video.src = src
        setIsLoading(false)
      } else {
        setError("HLS not supported in this browser")
        setIsLoading(false)
      }
    } else {
      // Regular video file
      video.src = src
      setIsLoading(false)
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [src])

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return

    if (isPlaying) {
      video.pause()
    } else {
      video.play()
    }
  }

  const handleSeek = (value: number[]) => {
    const video = videoRef.current
    if (!video) return

    const newTime = (value[0] / 100) * duration
    video.currentTime = newTime
    setCurrentTime(newTime)
  }

  const handleVolumeChange = (value: number[]) => {
    const video = videoRef.current
    if (!video) return

    const newVolume = value[0] / 100
    video.volume = newVolume
    setVolume(newVolume)
    setIsMuted(newVolume === 0)
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return

    if (isMuted) {
      video.volume = volume
      setIsMuted(false)
    } else {
      video.volume = 0
      setIsMuted(true)
    }
  }

  const toggleFullscreen = () => {
    const container = containerRef.current
    if (!container) return

    if (!isFullscreen) {
      if (container.requestFullscreen) {
        container.requestFullscreen()
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
      }
    }
    setIsFullscreen(!isFullscreen)
  }

  const skip = (seconds: number) => {
    const video = videoRef.current
    if (!video) return

    video.currentTime = Math.max(0, Math.min(duration, video.currentTime + seconds))
  }

  const handleQualityChange = (newQuality: string) => {
    const hls = hlsRef.current
    if (!hls) return

    setQuality(newQuality)

    if (newQuality === "auto") {
      hls.currentLevel = -1 // Auto quality
    } else {
      // Find the level index for the selected quality
      const levels = hls.levels
      const targetHeight = parseInt(newQuality.replace("p", ""))
      const levelIndex = levels.findIndex(level => level.height === targetHeight)
      
      if (levelIndex !== -1) {
        hls.currentLevel = levelIndex
        console.log(`Switched to ${newQuality} (level ${levelIndex})`)
      }
    }
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div
      ref={containerRef}
      className={cn("relative bg-black rounded-lg overflow-hidden group", className)}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => !isPlaying || setShowControls(true)}
      onMouseMove={() => setShowControls(true)}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
      >
        {subtitles.map((subtitle) => (
          <track
            key={subtitle.language}
            kind="subtitles"
            src={subtitle.src}
            srcLang={subtitle.language}
            label={subtitle.label}
            default={selectedSubtitle === subtitle.language}
          />
        ))}
      </video>

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      )}

      {/* Error indicator */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-center text-white">
            <div className="text-red-400 mb-2">⚠️</div>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Play button overlay */}
      {!isPlaying && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Button
            onClick={togglePlay}
            size="lg"
            className="bg-primary/80 hover:bg-primary text-primary-foreground rounded-full p-6"
          >
            <Play className="h-8 w-8 ml-1" />
          </Button>
        </div>
      )}

      {/* Controls */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0",
        )}
      >
        {/* Progress bar */}
        <div className="mb-4">
          <Slider value={[progressPercentage]} onValueChange={handleSeek} max={100} step={0.1} className="w-full" />
        </div>

        {/* Control buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button onClick={togglePlay} size="sm" variant="ghost" className="text-white hover:bg-white/20">
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </Button>

            <Button onClick={() => skip(-10)} size="sm" variant="ghost" className="text-white hover:bg-white/20">
              <SkipBack className="h-4 w-4" />
            </Button>

            <Button onClick={() => skip(10)} size="sm" variant="ghost" className="text-white hover:bg-white/20">
              <SkipForward className="h-4 w-4" />
            </Button>

            <div className="flex items-center space-x-2">
              <Button onClick={toggleMute} size="sm" variant="ghost" className="text-white hover:bg-white/20">
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              <div className="w-20">
                <Slider value={[isMuted ? 0 : volume * 100]} onValueChange={handleVolumeChange} max={100} step={1} />
              </div>
            </div>

            <span className="text-white text-sm">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {/* Subtitles */}
            <Select value={selectedSubtitle} onValueChange={setSelectedSubtitle}>
              <SelectTrigger className="w-auto bg-transparent border-none text-white">
                <Subtitles className="h-4 w-4" />
              </SelectTrigger>
              <SelectContent className="z-[9999]" side="top">
                <SelectItem value="off">Off</SelectItem>
                {subtitles.map((subtitle) => (
                  <SelectItem key={subtitle.language} value={subtitle.language}>
                    {subtitle.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Quality */}
            <Select value={quality} onValueChange={handleQualityChange}>
              <SelectTrigger className="w-auto bg-transparent border-none text-white">
                <Settings className="h-4 w-4" />
              </SelectTrigger>
              <SelectContent className="z-[9999]" side="top">
                {availableQualities.length > 0 ? (
                  availableQualities.map((q) => (
                    <SelectItem key={q} value={q}>
                      {q}
                    </SelectItem>
                  ))
                ) : (
                  <>
                    <SelectItem value="auto">Auto</SelectItem>
                    <SelectItem value="1080p">1080p</SelectItem>
                    <SelectItem value="720p">720p</SelectItem>
                    <SelectItem value="480p">480p</SelectItem>
                    <SelectItem value="360p">360p</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>

            <Button onClick={toggleFullscreen} size="sm" variant="ghost" className="text-white hover:bg-white/20">
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Title overlay */}
      {title && showControls && (
        <div className="absolute top-4 left-4 right-4">
          <h2 className="text-white text-xl font-semibold text-balance">{title}</h2>
        </div>
      )}
    </div>
  )
}
