"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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
import { apiService, API_BASE_URL, type PlaybackMetricPayload } from "@/lib/api"

type PlaybackMetricState = {
  sessionId: string
  mountTime?: number
  manifestRequestedAt?: number
  manifestLoadedAt?: number
  playbackRequestedAt?: number
  firstFrameAt?: number
  bufferingEvents: number
  deliverySource?: string
  bandwidthEstimateMbps?: number
  transferSize?: number
  encodedBodySize?: number
  nextHopProtocol?: string
  metricsSent: boolean
}

const createSessionId = () => {
  if (typeof globalThis !== "undefined") {
    const maybeCrypto = (globalThis as typeof globalThis & { crypto?: Crypto }).crypto
    if (maybeCrypto && typeof maybeCrypto.randomUUID === "function") {
      return maybeCrypto.randomUUID()
    }
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const now = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now()

const getDeviceType = (userAgent: string | undefined): string | undefined => {
  if (!userAgent) return undefined
  const ua = userAgent.toLowerCase()
  if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone") || ua.includes("ipad")) {
    return "mobile"
  }
  if (ua.includes("smart-tv") || ua.includes("appletv") || ua.includes("hbbtv")) {
    return "tv"
  }
  return "desktop"
}

const classifyDeliverySource = (entry?: PerformanceResourceTiming): string | undefined => {
  if (!entry) return undefined
  if (entry.transferSize === 0 && entry.decodedBodySize > 0) {
    return "disk_cache"
  }
  if (entry.transferSize > 0 && entry.encodedBodySize > 0) {
    const ratio = entry.transferSize / entry.encodedBodySize
    if (ratio < 1.05) {
      return "edge_cache"
    }
    return "origin"
  }
  return undefined
}

const extractHeaders = (networkDetails: any): Record<string, string> | undefined => {
  if (!networkDetails) return undefined

  if (typeof networkDetails.getAllResponseHeaders === "function") {
    const raw = networkDetails.getAllResponseHeaders()
    if (!raw) return undefined
    const lines = raw.trim().split(/[\r\n]+/)
    return lines.reduce((acc: Record<string, string>, line: string) => {
      const parts = line.split(":")
      if (parts.length >= 2) {
        const key = parts.shift()?.trim().toLowerCase()
        if (key) {
          acc[key] = parts.join(":").trim()
        }
      }
      return acc
    }, {} as Record<string, string>)
  }

  if (networkDetails.headers) {
    const headersObj: Record<string, string> = {}
    if (typeof networkDetails.headers.forEach === "function") {
      networkDetails.headers.forEach((value: string, key: string) => {
        headersObj[key.toLowerCase()] = value
      })
      return headersObj
    }

    if (typeof networkDetails.headers === "object") {
      for (const [key, value] of Object.entries(networkDetails.headers)) {
        if (typeof value === "string") {
          headersObj[key.toLowerCase()] = value
        }
      }
      return headersObj
    }
  }

  return undefined
}

const extractDeliverySource = (networkDetails: any): string | undefined => {
  const headers = extractHeaders(networkDetails)
  if (!headers) return undefined

  const cacheHeader =
    headers["cf-cache-status"] ||
    headers["x-cache"] ||
    headers["x-cache-status"] ||
    headers["x-served-by"] ||
    headers["age"]

  if (!cacheHeader) return undefined

  const value = cacheHeader.toString().toLowerCase()
  if (value.includes("hit")) return "edge_cache"
  if (value.includes("stale")) return "edge_cache"
  if (value.includes("miss")) return "origin"
  if (value.includes("bypass")) return "origin"
  if (value.includes("dynamic")) return "origin"

  if (headers["age"]) {
    const age = Number.parseInt(headers["age"], 10)
    if (!Number.isNaN(age) && age > 0) {
      return "edge_cache"
    }
  }

  return undefined
}

const captureResourceTiming = (url: string | null, state: PlaybackMetricState) => {
  if (!url || typeof performance === "undefined" || typeof performance.getEntriesByType !== "function") {
    return
  }

  const normalized = url.split("?")[0]
  const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[]
  const match = entries
    .filter((entry) => entry.name.startsWith(normalized) || normalized.startsWith(entry.name))
    .sort((a, b) => b.responseEnd - a.responseEnd)[0]

  if (match) {
    state.transferSize = match.transferSize
    state.encodedBodySize = match.encodedBodySize
    state.nextHopProtocol = match.nextHopProtocol
    state.deliverySource = state.deliverySource ?? classifyDeliverySource(match)
  }
}

interface VideoPlayerProps {
  src: string
  title?: string
  subtitles?: Array<{
    label: string
    src: string
    language: string
  }>
  className?: string
  videoId?: string
}

export default function VideoPlayer({ src, title, subtitles = [], className, videoId }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const playbackMetricsRef = useRef<PlaybackMetricState>({
    sessionId: createSessionId(),
    mountTime: now(),
    bufferingEvents: 0,
    metricsSent: false,
  })
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [quality, setQuality] = useState("auto")
  const [autoQualityLabel, setAutoQualityLabel] = useState<string | null>(null)
  const qualityRef = useRef(quality)
  const [selectedSubtitle, setSelectedSubtitle] = useState("off")
  const [isLoading, setIsLoading] = useState(true)
  const [isBuffering, setIsBuffering] = useState(false)
  const [error, setError] = useState("")
  const [availableQualities, setAvailableQualities] = useState<string[]>([])
  const [bufferedPercentage, setBufferedPercentage] = useState(0)

  const constructPayload = useCallback(
    (reason: string): PlaybackMetricPayload | undefined => {
      const state = playbackMetricsRef.current
      if (!state.firstFrameAt) return undefined

      const firstFrameMs =
        state.mountTime !== undefined ? Math.round(state.firstFrameAt - state.mountTime) : undefined
      const startupMs =
        state.playbackRequestedAt !== undefined
          ? Math.round(state.firstFrameAt - state.playbackRequestedAt)
          : firstFrameMs

      if (typeof navigator === "undefined") return undefined

      const connection = (navigator as unknown as { connection?: any }).connection

      return {
        benchmark_run_source: "playback_client",
        benchmark_metadata: {
          session_id: state.sessionId,
          reason,
          manifest_latency_ms:
            state.manifestLoadedAt !== undefined && state.manifestRequestedAt !== undefined
              ? Math.round(state.manifestLoadedAt - state.manifestRequestedAt)
              : undefined,
          transfer_size_bytes: state.transferSize,
          encoded_body_size_bytes: state.encodedBodySize,
          next_hop_protocol: state.nextHopProtocol,
          connection_type: connection?.effectiveType,
          delivery_source: state.deliverySource,
          user_agent: navigator.userAgent,
          language: navigator.language,
          downlink: connection?.downlink,
          rtt: connection?.rtt,
        },
        video_id: videoId,
        device_type: getDeviceType(navigator.userAgent),
        bandwidth_mbps: state.bandwidthEstimateMbps ?? connection?.downlink ?? undefined,
        first_frame_ms: firstFrameMs,
        total_startup_ms: startupMs,
        buffering_events: state.bufferingEvents,
      }
    },
    [videoId],
  )

  const sendPlaybackMetrics = useCallback(
    async (reason: string, preferBeacon = false) => {
      const state = playbackMetricsRef.current
      if (state.metricsSent) return

      const payload = constructPayload(reason)
      if (!payload) return

      state.metricsSent = true

      console.log("sendBeacon, payload", preferBeacon, payload)
      if (preferBeacon && typeof navigator !== "undefined" && typeof (navigator as any).sendBeacon === "function") {
        console.log("sendBeacon inside")
        const blob = new Blob([JSON.stringify(payload)], { type: "application/json" })
          ; (navigator as any).sendBeacon(`${API_BASE_URL}/metrics/playback`, blob)
        return
      }

      void apiService.recordPlaybackMetric(payload)
    },
    [constructPayload],
  )

  useEffect(() => {
    const state = playbackMetricsRef.current
    console.log("source_change", state.firstFrameAt, state.metricsSent)
    if (state.firstFrameAt && !state.metricsSent) {
      void sendPlaybackMetrics("source_change")
    }
    console.log("source_change after", state.firstFrameAt, state.metricsSent)
    playbackMetricsRef.current = {
      sessionId: createSessionId(),
      mountTime: now(),
      bufferingEvents: 0,
      metricsSent: false,
    }
  }, [sendPlaybackMetrics, src, videoId])

  useEffect(() => {
    if (typeof window === "undefined") return

    const handleBeforeUnload = () => {
      console.log("beforeunload")
      if (playbackMetricsRef.current.metricsSent) return
      if (!playbackMetricsRef.current.firstFrameAt) return
      void sendPlaybackMetrics("beforeunload", true)
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [sendPlaybackMetrics])

  useEffect(() => {
    return () => {
      if (!playbackMetricsRef.current.metricsSent && playbackMetricsRef.current.firstFrameAt) {
        void sendPlaybackMetrics("unmount", true)
      }
    }
  }, [sendPlaybackMetrics])

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

    const updateBufferedState = () => {
      if (!video) return
      const { buffered, duration: mediaDuration } = video
      if (!buffered || buffered.length === 0 || !isFinite(mediaDuration) || mediaDuration <= 0) {
        setBufferedPercentage(0)
        return
      }

      const bufferedEnd = buffered.end(buffered.length - 1)
      const clampedEnd = Math.min(Math.max(bufferedEnd, 0), mediaDuration)
      const percent = (clampedEnd / mediaDuration) * 100
      setBufferedPercentage(percent)
    }

    const handleLoadedMetadata = () => {
      setDuration(video.duration)
      setIsLoading(false)
      updateBufferedState()
      playbackMetricsRef.current.manifestLoadedAt = playbackMetricsRef.current.manifestLoadedAt ?? now()
      captureResourceTiming(video.currentSrc, playbackMetricsRef.current)
    }

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime)
      updateBufferedState()
    }

    const handlePlay = () => {
      setIsPlaying(true)
      setIsBuffering(false)
      playbackMetricsRef.current.playbackRequestedAt =
        playbackMetricsRef.current.playbackRequestedAt ?? now()
    }
    const handlePause = () => setIsPlaying(false)
    const handleWaiting = () => {
      if (!video.paused && video.readyState < 3) {
        setIsBuffering(true)
        playbackMetricsRef.current.bufferingEvents += 1
      }
    }
    const handleStalled = () => {
      if (!video.paused) {
        setIsBuffering(true)
        playbackMetricsRef.current.bufferingEvents += 1
      }
    }
    const handlePlaying = () => {
      setIsBuffering(false)
      playbackMetricsRef.current.firstFrameAt = playbackMetricsRef.current.firstFrameAt ?? now()
    }
    const handleCanPlay = () => {
      setIsBuffering(false)
      captureResourceTiming(video.currentSrc, playbackMetricsRef.current)
    }
    const handleProgress = () => updateBufferedState()
    const handleEnded = () => {
      setIsPlaying(false)
      void sendPlaybackMetrics("ended")
    }
    const handleError = () => {
      setError("Playback error")
      void sendPlaybackMetrics("error")
    }
    const handleLoadStart = () => {
      playbackMetricsRef.current.manifestRequestedAt =
        playbackMetricsRef.current.manifestRequestedAt ?? now()
    }

    video.addEventListener("loadedmetadata", handleLoadedMetadata)
    video.addEventListener("timeupdate", handleTimeUpdate)
    video.addEventListener("play", handlePlay)
    video.addEventListener("pause", handlePause)
    video.addEventListener("progress", handleProgress)
    video.addEventListener("waiting", handleWaiting)
    video.addEventListener("stalled", handleStalled)
    video.addEventListener("playing", handlePlaying)
    video.addEventListener("canplay", handleCanPlay)
    video.addEventListener("ended", handleEnded)
    video.addEventListener("error", handleError)
    video.addEventListener("loadstart", handleLoadStart)

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata)
      video.removeEventListener("timeupdate", handleTimeUpdate)
      video.removeEventListener("play", handlePlay)
      video.removeEventListener("pause", handlePause)
      video.removeEventListener("progress", handleProgress)
      video.removeEventListener("waiting", handleWaiting)
      video.removeEventListener("stalled", handleStalled)
      video.removeEventListener("playing", handlePlaying)
      video.removeEventListener("canplay", handleCanPlay)
      video.removeEventListener("ended", handleEnded)
      video.removeEventListener("error", handleError)
      video.removeEventListener("loadstart", handleLoadStart)
    }
  }, [sendPlaybackMetrics])

  // HLS support with hls.js
  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return

    setBufferedPercentage(0)
    setQuality("auto")
    setAutoQualityLabel(null)

    // Clean up previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    setIsLoading(true)
    setIsBuffering(false)
    setError("")

    if (src.includes(".m3u8")) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          startLevel: -1,
          autoStartLoad: true,
          capLevelToPlayerSize: true,
        })

        hlsRef.current = hls

        hls.on(Hls.Events.MANIFEST_LOADING, () => {
          playbackMetricsRef.current.manifestRequestedAt = now()
        })

        hls.on(Hls.Events.MANIFEST_LOADED, (_, data: any) => {
          playbackMetricsRef.current.manifestLoadedAt = now()
          const delivery = extractDeliverySource(data?.networkDetails)
          if (delivery) {
            playbackMetricsRef.current.deliverySource = delivery
          }
          captureResourceTiming(src, playbackMetricsRef.current)
        })

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
          hls.currentLevel = -1
          hls.nextLevel = -1
          hls.loadLevel = -1
          hls.autoLevelCapping = -1
          setQuality("auto")
          setAutoQualityLabel(
            qualities.length > 0 ? `${qualities[0].label}` : null,
          )

          console.log("Available qualities:", qualityLabels)
        })

        hls.on(Hls.Events.LEVEL_SWITCHED, (event: any, data: any) => {
          console.log("Quality switched to level:", data.level)
          const currentLevel = hls.levels[data.level]
          if (currentLevel) {
            const label = `${currentLevel.height}p`
            console.log(`Now playing at ${currentLevel.height}p`)
            if (qualityRef.current === "auto") {
              setAutoQualityLabel(label)
            }
          }
        })

        hls.on(Hls.Events.FRAG_LOADED, (_event: any, data: any) => {
          const stats = data?.stats
          if (stats?.bwEstimate && stats.bwEstimate > 0) {
            playbackMetricsRef.current.bandwidthEstimateMbps = Number(
              (stats.bwEstimate / 1_000_000).toFixed(2),
            )
          }
          if (!playbackMetricsRef.current.deliverySource) {
            const delivery = extractDeliverySource(data?.networkDetails)
            if (delivery) {
              playbackMetricsRef.current.deliverySource = delivery
            }
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

  useEffect(() => {
    qualityRef.current = quality
  }, [quality])

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
    const video = videoRef.current
    if (!hls) return

    setQuality(newQuality)

    if (newQuality === "auto") {
      hls.currentLevel = -1 // Auto quality
      hls.loadLevel = -1
      hls.nextLevel = -1
      setAutoQualityLabel(null)
      return
    }

    const levels = hls.levels
    const targetHeight = parseInt(newQuality.replace("p", ""))
    const levelIndex = levels.findIndex((level) => level.height === targetHeight)

    if (levelIndex === -1) return

    const currentManualIndex =
      hls.currentLevel >= 0
        ? hls.currentLevel
        : hls.loadLevel >= 0
          ? hls.loadLevel
          : hls.nextLevel >= 0
            ? hls.nextLevel
            : -1

    const currentHeight =
      currentManualIndex >= 0 && levels[currentManualIndex] ? levels[currentManualIndex].height ?? 0 : 0

    const isUpgrade = currentHeight > 0 && targetHeight > currentHeight

    if (isUpgrade) {
      const resumePlayback = video ? !video.paused : false
      const currentPlaybackTime = video?.currentTime ?? null

      hls.currentLevel = levelIndex
      hls.nextLevel = levelIndex
      hls.loadLevel = levelIndex

      if (currentPlaybackTime !== null) {
        const handleBufferAppended = () => {
          hls.off(Hls.Events.BUFFER_APPENDED, handleBufferAppended)
          if (!video) return
          video.currentTime = currentPlaybackTime
          if (resumePlayback) {
            void video.play().catch(() => { })
          }
        }
        hls.on(Hls.Events.BUFFER_APPENDED, handleBufferAppended)
      }
    } else {
      // Schedule quality change on the next fragment to avoid visible stalls when stepping down
      hls.nextLevel = levelIndex
      hls.loadLevel = levelIndex

      // If the video is paused, switch immediately so the next play uses the desired level
      if (video?.paused) {
        hls.currentLevel = levelIndex
      }
    }

    console.log(`Switched to ${newQuality} (level ${levelIndex})`)
    setAutoQualityLabel(null)
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0
  const clampedProgress = Math.max(0, Math.min(progressPercentage, 100))
  const clampedBuffered = Math.max(0, Math.min(bufferedPercentage, 100))

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
      {(isLoading || isBuffering) && (
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
        <div className="relative mb-4 h-6">
          <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/15" />
          <div
            className="pointer-events-none absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/35"
            style={{ width: `${clampedBuffered}%` }}
          />
          <Slider
            value={[clampedProgress]}
            onValueChange={handleSeek}
            max={100}
            step={0.1}
            className="relative z-10 h-6"
            trackClassName="bg-transparent"
            rangeClassName="bg-primary"
          />
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
                {quality === "auto" && autoQualityLabel ? (
                  <span className="ml-2 text-xs uppercase tracking-wide">{autoQualityLabel}</span>
                ) : null}
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

