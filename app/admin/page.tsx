"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/components/auth-context"
import { apiService, type PaginatedResponse, type Video as ApiVideo, VideoStatus } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import VideoUpload from "@/components/video-upload"
import {
  Edit,
  Trash2,
  Eye,
  Loader2,
  VideoIcon,
  Save,
  X,
  CheckCircle,
  HardDrive,
} from "lucide-react"

const formatDuration = (duration?: number | null) => {
  if (!duration || duration <= 0) {
    return "0:00"
  }

  const minutes = Math.floor(duration / 60)
  const seconds = duration % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

const formatFileSize = (bytes?: number | null) => {
  if (!bytes || bytes <= 0) {
    return "0 B"
  }

  const units = ["B", "KB", "MB", "GB", "TB"]
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, exponent)

  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`
}

export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth()
  const [videos, setVideos] = useState<ApiVideo[]>([])
  const [pagination, setPagination] = useState<PaginatedResponse<ApiVideo>["pagination"] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [editingVideo, setEditingVideo] = useState<ApiVideo | null>(null)
  const [editForm, setEditForm] = useState({ title: "", description: "" })
  const [editError, setEditError] = useState("")
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchVideos = useCallback(async () => {
    if (!user) {
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const response = await apiService.getVideos(50, 0)

      if (response.success && response.data) {
        setVideos(response.data.data)
        setPagination(response.data.pagination)
      } else {
        setError(response.error || "Failed to load videos")
      }
    } catch (err) {
      console.error("Failed to load videos:", err)
      setError("Failed to load videos")
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!authLoading && user) {
      fetchVideos()
    }
  }, [authLoading, user, fetchVideos])

  const totalVideos = pagination?.total ?? videos.length
  const readyCount = videos.filter((video) => video.status === VideoStatus.Ready).length
  const processingCount = videos.filter((video) => video.status === VideoStatus.Processing).length
  const storageUsed = formatFileSize(
    videos.reduce((sum, video) => sum + (video.file_size ?? 0), 0),
  )

  const handleEditVideo = (video: ApiVideo) => {
    setEditingVideo(video)
    setEditForm({
      title: video.title,
      description: video.description ?? "",
    })
    setEditError("")
  }

  const handleDeleteVideo = async (id: string) => {
    const confirmed = window.confirm("Are you sure you want to remove this video? This action cannot be undone.")
    if (!confirmed) return

    setDeletingId(id)
    setError("")
    setSuccessMessage("")

    try {
      const response = await apiService.deleteVideo(id)

      if (response.success) {
        setVideos((prev) => prev.filter((video) => video.id !== id))
        setPagination((prev) =>
          prev
            ? {
                ...prev,
                total: Math.max(prev.total - 1, 0),
              }
            : prev,
        )
        setSuccessMessage("Video removed successfully")
      } else {
        setError(response.error || "Failed to delete video")
      }
    } catch (err) {
      console.error("Failed to delete video:", err)
      setError("Failed to delete video")
    } finally {
      setDeletingId(null)
    }
  }

  const handleSaveEdit = async () => {
    if (!editingVideo) {
      return
    }

    const trimmedTitle = editForm.title.trim()
    const trimmedDescription = editForm.description.trim()

    if (!trimmedTitle) {
      setEditError("Title is required")
      return
    }

    const payload: { title?: string; description?: string | null } = {}

    if (trimmedTitle !== editingVideo.title) {
      payload.title = trimmedTitle
    }

    if (trimmedDescription !== (editingVideo.description ?? "")) {
      payload.description = trimmedDescription
    }

    if (Object.keys(payload).length === 0) {
      setEditingVideo(null)
      return
    }

    setIsSavingEdit(true)
    setEditError("")

    try {
      const response = await apiService.updateVideo(editingVideo.id, payload)

      if (response.success && response.data) {
        const updatedVideo = response.data
        setVideos((prev) => prev.map((video) => (video.id === updatedVideo.id ? updatedVideo : video)))
        setSuccessMessage("Video updated successfully")
        setEditingVideo(null)
        setEditForm({ title: "", description: "" })
      } else {
        setEditError(response.error || "Failed to update video")
      }
    } catch (err) {
      console.error("Failed to update video:", err)
      setEditError("Failed to update video")
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleUploadSuccess = () => {
    setSuccessMessage("Video uploaded successfully")
    fetchVideos()
  }

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex items-center space-x-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Checking permissions…</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Restricted</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              You need administrative privileges to view this dashboard.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-bold text-foreground">Video Admin Dashboard</h1>
            <p className="text-muted-foreground">
              Review your uploaded videos, update their metadata, and remove outdated content.
            </p>
          </div>
          <Button asChild variant="outline" className="w-full md:w-auto">
            <Link href="/insights">Go to Insights</Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          <Card>
            <CardContent className="flex items-center space-x-3 p-6">
              <VideoIcon className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{totalVideos}</p>
                <p className="text-sm text-muted-foreground">Total Videos</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center space-x-3 p-6">
              <Eye className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="text-2xl font-bold">{readyCount}</p>
                <p className="text-sm text-muted-foreground">Ready to Stream</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center space-x-3 p-6">
              <Loader2 className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-2xl font-bold">{processingCount}</p>
                <p className="text-sm text-muted-foreground">Processing</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center space-x-3 p-6">
              <HardDrive className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{storageUsed}</p>
                <p className="text-sm text-muted-foreground">Storage Used (current page)</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="videos" className="space-y-6">
          <TabsList>
            <TabsTrigger value="videos">Manage Videos</TabsTrigger>
            <TabsTrigger value="upload">Upload Video</TabsTrigger>
          </TabsList>

          <TabsContent value="videos" className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {successMessage && (
              <Alert>
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                <AlertDescription>{successMessage}</AlertDescription>
              </Alert>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Video Library</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="ml-2">Loading videos…</span>
                  </div>
                ) : videos.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-muted-foreground">No videos found. Upload your first video to get started.</p>
                  </div>
                ) : (
                  videos.map((video) => (
                    <div
                      key={video.id}
                      className="flex flex-col gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-accent/40 md:flex-row md:items-center"
                    >
                      <div className="flex w-full items-start gap-4 md:w-1/2">
                        <img
                          src={video.thumbnail_url || "/placeholder.svg"}
                          alt={video.title}
                          className="h-24 w-40 rounded object-cover"
                        />
                        <div className="space-y-2">
                          <h3 className="text-lg font-semibold text-foreground">{video.title}</h3>
                          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                            <Badge variant="secondary" className="capitalize">
                              {video.status}
                            </Badge>
                            <span>{formatDuration(video.duration)}</span>
                            <span>•</span>
                            <span>{new Date(video.created_at).toLocaleString()}</span>
                          </div>
                          {video.description && (
                            <p className="line-clamp-2 text-sm text-muted-foreground">{video.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex w-full items-center justify-between gap-4 md:w-1/2 md:justify-end">
                        <div className="flex flex-col items-start gap-1 text-sm text-muted-foreground md:items-end">
                          <span>Size: {formatFileSize(video.file_size)}</span>
                          <span>ID: <code className="text-xs">{video.id}</code></span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditVideo(video)}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteVideo(video.id)}
                            disabled={deletingId === video.id}
                          >
                            {deletingId === video.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="mr-2 h-4 w-4" />
                            )}
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="upload" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Upload New Video</CardTitle>
              </CardHeader>
              <CardContent>
                <VideoUpload onUploadSuccess={handleUploadSuccess} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {editingVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle>Edit Video</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {editError && (
                <Alert variant="destructive">
                  <AlertDescription>{editError}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={editForm.title}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={editForm.description}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  placeholder="Add an optional description"
                />
              </div>
              <div className="flex gap-3">
                <Button onClick={handleSaveEdit} className="flex-1" disabled={isSavingEdit}>
                  {isSavingEdit ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save changes
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setEditingVideo(null)
                    setEditForm({ title: "", description: "" })
                  }}
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
