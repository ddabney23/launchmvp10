/**
 * Image Optimization Utilities
 * Provides image optimization, lazy loading, and responsive image handling
 */

export interface ImageOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: "webp" | "jpg" | "png" | "avif";
  fit?: "cover" | "contain" | "fill" | "inside" | "outside";
}

/**
 * Generate optimized image URL for Supabase Storage
 */
export function getOptimizedImageUrl(
  imageUrl: string,
  options: ImageOptions = {}
): string {
  // If it's already a Supabase Storage URL, we can use transformations
  if (imageUrl.includes("supabase.co/storage")) {
    const params = new URLSearchParams();
    
    if (options.width) params.append("width", options.width.toString());
    if (options.height) params.append("height", options.height.toString());
    if (options.quality) params.append("quality", options.quality.toString());
    if (options.format) params.append("format", options.format);
    if (options.fit) params.append("resize", options.fit);
    
    const queryString = params.toString();
    return queryString ? `${imageUrl}?${queryString}` : imageUrl;
  }
  
  // For external URLs, return as-is (or use a CDN service)
  return imageUrl;
}

/**
 * Generate responsive image srcset
 */
export function generateSrcSet(
  baseUrl: string,
  widths: number[] = [320, 640, 768, 1024, 1280, 1920]
): string {
  return widths
    .map((width) => `${getOptimizedImageUrl(baseUrl, { width })} ${width}w`)
    .join(", ");
}

/**
 * Get image dimensions from URL or file
 */
export function getImageDimensions(
  src: string | File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };
    
    img.onerror = reject;
    
    if (typeof src === "string") {
      img.src = src;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(src);
    }
  });
}

/**
 * Compress image file
 */
export function compressImage(
  file: File,
  maxWidth: number = 1920,
  maxHeight: number = 1920,
  quality: number = 0.8,
  format: "webp" | "jpeg" = "webp"
): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        
        // Calculate new dimensions
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = width * ratio;
          height = height * ratio;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Failed to compress image"));
              return;
            }
            
            const compressedFile = new File(
              [blob],
              file.name.replace(/\.[^/.]+$/, `.${format}`),
              {
                type: `image/${format}`,
                lastModified: Date.now(),
              }
            );
            
            resolve(compressedFile);
          },
          `image/${format}`,
          quality
        );
      };
      
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Lazy load image component props
 */
export interface LazyImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  placeholder?: string;
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * Create optimized image props for Next.js Image or similar
 */
export function createOptimizedImageProps(
  src: string,
  options: ImageOptions & { alt: string; className?: string }
) {
  return {
    src: getOptimizedImageUrl(src, options),
    srcSet: generateSrcSet(src),
    alt: options.alt,
    className: options.className,
    loading: "lazy" as const,
    decoding: "async" as const,
  };
}

/**
 * Preload critical images
 */
export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = src;
    
    link.onload = () => resolve();
    link.onerror = reject;
    
    document.head.appendChild(link);
  });
}

/**
 * Check if WebP is supported
 */
export function isWebPSupported(): boolean {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL("image/webp").indexOf("data:image/webp") === 0;
}

/**
 * Get best image format based on browser support
 */
export function getBestImageFormat(): "webp" | "avif" | "jpg" {
  // Check AVIF support
  const avifCanvas = document.createElement("canvas");
  avifCanvas.width = 1;
  avifCanvas.height = 1;
  if (avifCanvas.toDataURL("image/avif").indexOf("data:image/avif") === 0) {
    return "avif";
  }
  
  // Check WebP support
  if (isWebPSupported()) {
    return "webp";
  }
  
  // Fallback to JPG
  return "jpg";
}

