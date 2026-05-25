'use client'

import { useState, useRef } from 'react'
import { X, Upload, Image as ImageIcon, Video, Camera, Globe, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import { createStory, uploadFile } from '@/lib/api'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'

interface CreateStoryProps {
  open: boolean
  onClose: () => void
}

export function CreateStory({ open, onClose }: CreateStoryProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const router = useRouter()
  const { user: authUser, isAuthenticated: isSignedIn, loading: authLoading } = useAuth()
  const clerkUser = authUser
  const userLoaded = !authLoading
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'followers'>('public')
  const [isUploading, setIsUploading] = useState(false)

  const createStoryMutation = useMutation({
    mutationFn: createStory,
    onSuccess: () => {
      toast({
        title: 'Story created! 🎉',
        description: 'Your story is now live and will expire in 24 hours.',
      })
      queryClient.invalidateQueries({ queryKey: ['stories'] })
      handleClose()
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create story',
        description: error.message,
        variant: 'destructive',
      })
      setIsUploading(false)
    },
  })

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    // Validate file type
    if (!selectedFile.type.startsWith('image/') && !selectedFile.type.startsWith('video/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select an image or video file.',
        variant: 'destructive',
      })
      return
    }

    // Validate file size (50MB limit for stories)
    const maxSize = 50 * 1024 * 1024 // 50MB
    if (selectedFile.size > maxSize) {
      toast({
        title: 'File too large',
        description: 'Story files must be less than 50MB.',
        variant: 'destructive',
      })
      return
    }

    // Validate video duration (max 30 seconds)
    if (selectedFile.type.startsWith('video/')) {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src)
        const duration = video.duration
        if (duration > 30) {
          toast({
            title: 'Video too long',
            description: 'Story videos must be 30 seconds or less.',
            variant: 'destructive',
          })
          return
        }
      }
      video.src = URL.createObjectURL(selectedFile)
    }

    setFile(selectedFile)

    // Create preview
    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result as string)
      }
      reader.readAsDataURL(selectedFile)
    } else {
      // Video preview
      const videoUrl = URL.createObjectURL(selectedFile)
      setPreview(videoUrl)
    }
  }

  const handleSubmit = async () => {
    console.log('=== STORY SUBMIT ===')
    console.log('isSignedIn:', isSignedIn)
    console.log('userLoaded:', userLoaded)
    console.log('clerkUser:', clerkUser?.id)
    console.log('file:', file?.name)
    
    if (!userLoaded) {
      toast({
        title: 'Loading...',
        description: 'Please wait while we verify your account.',
        variant: 'default',
      })
      return
    }
    
    if (!isSignedIn || !clerkUser) {
      console.log('User not signed in - redirecting to auth')
      toast({
        title: 'Please sign in',
        description: 'You need to be signed in to create a story.',
        variant: 'destructive',
      })
      router.push('/auth')
      return
    }
    
    if (!file) {
      toast({
        title: 'No file selected',
        description: 'Please select an image or video to share.',
        variant: 'destructive',
      })
      return
    }

    setIsUploading(true)

    try {
      // Determine media type
      const mediaType = file.type.startsWith('video/') ? 'video' : 'image'

      // Upload file to Supabase Storage
      const timestamp = Date.now()
      const randomId = Math.random().toString(36).substring(2, 9)
      const extension = file.name.split('.').pop() || 'jpg'
      const filePath = `stories/${timestamp}-${randomId}.${extension}`

      let mediaUrl: string
      try {
        mediaUrl = await uploadFile('stories', filePath, file)
      } catch (uploadError) {
        toast({
          title: 'Upload failed',
          description: uploadError instanceof Error ? uploadError.message : 'Failed to upload file. Please try again.',
          variant: 'destructive',
        })
        setIsUploading(false)
        return
      }

      // Create story
      createStoryMutation.mutate({
        media_url: mediaUrl,
        media_type: mediaType,
        caption: caption.trim() || null,
        visibility,
      })
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Failed to upload story',
        variant: 'destructive',
      })
      setIsUploading(false)
    }
  }

  const handleClose = () => {
    setFile(null)
    setPreview(null)
    setCaption('')
    setVisibility('public')
    setIsUploading(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Story</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* File upload area */}
          {!preview ? (
            <div
              className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Camera className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Tap to add photo or video</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Images or videos up to 30 seconds
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      fileInputRef.current?.click()
                    }}
                  >
                    <ImageIcon className="w-4 h-4 mr-2" />
                    Choose File
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative">
              {file?.type.startsWith('image/') ? (
                <img
                  src={preview}
                  alt="Story preview"
                  className="w-full h-64 object-cover rounded-lg"
                />
              ) : (
                <video
                  src={preview}
                  className="w-full h-64 object-cover rounded-lg"
                  controls
                />
              )}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white"
                onClick={() => {
                  setFile(null)
                  setPreview(null)
                  if (fileInputRef.current) {
                    fileInputRef.current.value = ''
                  }
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Caption */}
          <div className="space-y-2">
            <Label htmlFor="caption">Caption (optional)</Label>
            <Textarea
              id="caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption to your story..."
              maxLength={500}
              rows={3}
            />
            <p className="text-xs text-muted-foreground text-right">
              {caption.length}/500
            </p>
          </div>

          {/* Visibility */}
          <div className="space-y-2">
            <Label htmlFor="visibility">Who can see this story?</Label>
            <Select value={visibility} onValueChange={(value: 'public' | 'followers') => setVisibility(value)}>
              <SelectTrigger id="visibility">
                <div className="flex items-center gap-2">
                  {visibility === 'public' ? (
                    <Globe className="w-4 h-4" />
                  ) : (
                    <Users className="w-4 h-4" />
                  )}
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    <span>Everyone</span>
                  </div>
                </SelectItem>
                <SelectItem value="followers">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>Followers only</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isUploading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!file || isUploading}
              className="flex-1 bg-linear-to-r from-primary to-secondary"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sharing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Share to Story
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

