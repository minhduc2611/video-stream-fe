"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Upload, X, FileVideo, CheckCircle, AlertCircle } from "lucide-react"
import { apiService } from "@/lib/api"
import { useAuth } from "@/components/auth-context"

interface VideoUploadProps {
  onUploadSuccess?: () => void
  className?: string
}

export default function VideoUpload({ onUploadSuccess, className }: VideoUploadProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const { user } = useAuth()

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    const droppedFiles = Array.from(e.dataTransfer.files)
    const videoFiles = droppedFiles.filter(file => {
      const extension = file.name.toLowerCase().split('.').pop()
      return ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v'].includes(extension || '')
    })
    
    if (videoFiles.length !== droppedFiles.length) {
      setError("Please only upload video files (MP4, MOV, AVI, MKV, WebM, FLV, WMV, M4V)")
      return
    }
    
    if (videoFiles.length > 1) {
      setError("Please upload only one video file at a time")
      return
    }
    
    setFiles(prev => [...prev, ...videoFiles])
    setError("")
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    const videoFiles = selectedFiles.filter(file => {
      const extension = file.name.toLowerCase().split('.').pop()
      return ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v'].includes(extension || '')
    })
    
    if (videoFiles.length !== selectedFiles.length) {
      setError("Please only upload video files (MP4, MOV, AVI, MKV, WebM, FLV, WMV, M4V)")
      return
    }
    
    if (videoFiles.length > 1) {
      setError("Please upload only one video file at a time")
      return
    }
    
    setFiles(prev => [...prev, ...videoFiles])
    setError("")
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const hasVideoFile = files.length > 0

  const handleUpload = async () => {
    if (!title.trim()) {
      setError("Please enter a video title")
      return
    }

    if (files.length === 0) {
      setError("Please select a video file to upload")
      return
    }

    setIsUploading(true)
    setError("")
    setSuccess("")
    setUploadProgress(0)

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return prev + 10
        })
      }, 200)

      const response = await apiService.uploadVideo(
        title,
        description || undefined,
        files
      )

      clearInterval(progressInterval)
      setUploadProgress(100)

      if (response.success) {
        setSuccess(`Video "${title}" uploaded successfully!`)
        setTitle("")
        setDescription("")
        setFiles([])
        onUploadSuccess?.()
      } else {
        setError(response.error || "Upload failed")
      }
    } catch (error) {
      setError("Upload failed. Please try again.")
    } finally {
      setIsUploading(false)
      setTimeout(() => {
        setUploadProgress(0)
        setSuccess("")
      }, 3000)
    }
  }

  if (!user) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please sign in to upload videos.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Video
        </CardTitle>
        <CardDescription>
          Upload your video file and we'll automatically convert it to HLS format for streaming.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-green-500/60 bg-green-500/10 text-green-700 transition-all duration-200 dark:border-green-500/40 dark:bg-green-500/10 dark:text-green-200 shadow-sm">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            <AlertTitle className="text-green-800 dark:text-green-200">Upload complete</AlertTitle>
            <AlertDescription className="text-green-700 dark:text-green-100">
              {success}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Video Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter video title"
              disabled={isUploading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter video description (optional)"
              disabled={isUploading}
              rows={3}
            />
          </div>
        </div>

        {/* File Upload Area */}
        <div
          className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors"
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <FileVideo className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <div className="space-y-2">
            <p className="text-lg font-medium">Drop video file here</p>
            <p className="text-sm text-muted-foreground">
              or click to select a video file (MP4, MOV, AVI, MKV, WebM, FLV, WMV, M4V)
            </p>
            <Input
              type="file"
              accept="video/*,.mp4,.mov,.avi,.mkv,.webm,.flv,.wmv,.m4v"
              onChange={handleFileSelect}
              disabled={isUploading}
              className="hidden"
              id="file-upload"
            />
            <Button
              variant="outline"
              onClick={() => document.getElementById('file-upload')?.click()}
              disabled={isUploading}
            >
              Select Files
            </Button>
          </div>
        </div>

        {/* Selected File */}
        {files.length > 0 && (
          <div className="space-y-2">
            <Label>Selected Video File</Label>
            <div className="space-y-2">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <FileVideo className="h-5 w-5 text-primary" />
                    <div>
                      <span className="text-sm font-medium">{file.name}</span>
                      <div className="text-xs text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                    disabled={isUploading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload Progress */}
        {isUploading && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Uploading...</span>
              <span>{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="w-full" />
          </div>
        )}

        {/* Upload Button */}
        <Button
          onClick={handleUpload}
          disabled={isUploading || !title.trim() || files.length === 0}
          className="w-full"
        >
          {isUploading ? "Uploading..." : "Upload Video"}
        </Button>

        {/* Requirements */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Supported Formats:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>MP4, MOV, AVI, MKV, WebM, FLV, WMV, M4V</li>
            <li>Maximum file size: 2GB</li>
            <li>Video will be automatically converted to HLS format</li>
            <li>Processing may take a few minutes depending on file size</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}


