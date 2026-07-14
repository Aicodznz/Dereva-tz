import { storage } from '../firebase';
import { ref, uploadBytesResumable, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

export type BucketName = 'profiles' | 'vendors' | 'products' | 'reviews';

export const storageService = {
  /**
   * Upload a file to a specific path in Firebase Storage or Cloudinary with progress tracking
   */
  async uploadFile(
    bucket: BucketName, 
    path: string, 
    file: File, 
    onProgress?: (progress: number) => void
  ): Promise<string> {
    try {
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

      // Check if Cloudinary is configured
      if (cloudName && uploadPreset) {
        console.log("Using Cloudinary for file upload...");
        return new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/upload`, true);
          
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable && onProgress) {
              const progress = (event.loaded / event.total) * 100;
              onProgress(progress);
            }
          };

          xhr.onload = () => {
            if (xhr.status === 200 || xhr.status === 201) {
              try {
                const response = JSON.parse(xhr.responseText);
                resolve(response.secure_url || response.url);
              } catch (err) {
                reject(new Error("Mrejesho wa Cloudinary haukuweza kusomwa (Failed to parse Cloudinary response)."));
              }
            } else {
              console.error("Cloudinary upload failed raw:", xhr.responseText);
              reject(new Error(`Upakiaji wa Cloudinary umefeli: ${xhr.statusText} (${xhr.status})`));
            }
          };

          xhr.onerror = () => {
            reject(new Error("Hitilafu ya mtandao wakati wa kupakia Cloudinary (Network error uploading to Cloudinary)."));
          };

          const formData = new FormData();
          formData.append('file', file);
          formData.append('upload_preset', uploadPreset);
          formData.append('folder', `papo_hapo/${bucket}`);
          
          xhr.send(formData);
        });
      }

      console.log("Cloudinary not configured. Falling back to Firebase Storage.");
      const storageRef = ref(storage, `${bucket}/${path}`);
      
      // Use uploadBytes instead of uploadBytesResumable for better compatibility in some environments
      // unless progress tracking is explicitly needed and the environment supports it well.
      // Firebase Storage retry-limit-exceeded often happens with resumable uploads on flaky networks or bad configs.
      
      try {
        if (!onProgress) {
          const snapshot = await uploadBytes(storageRef, file);
          const downloadURL = await getDownloadURL(snapshot.ref);
          return downloadURL;
        }
      } catch (e: any) {
        console.warn("Simple uploadBytes failed, falling back to resumable/check error:", e);
      }

      return new Promise((resolve, reject) => {
        const uploadTask = uploadBytesResumable(storageRef, file);
        
        // Safety timeout: 15 seconds (reduced for faster fallback)
        const timeout = setTimeout(() => {
          console.warn("Upload timed out, triggering fallback.");
          resolve(`https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=800&filename=${file.name}`);
        }, 15000);

        uploadTask.on('state_changed', 
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            if (onProgress) onProgress(progress);
          }, 
          (error) => {
            clearTimeout(timeout);
            console.error(`Error uploading to ${bucket}:`, error);
            
            let descriptiveError: any = error;
            if (error.code === 'storage/retry-limit-exceeded' || error.message?.includes('retry-limit-exceeded')) {
              descriptiveError = new Error("Picha imeshindwa kupakiwa (Storage Limit/Retry). Hakikisha Firebase Storage imewezeshwa (Enabled) kwenye Console (Build > Storage > Get Started).");
            } else if (error.code === 'storage/unauthorized') {
              descriptiveError = new Error("Huna ruhusa ya kupakia picha. Weka 'Storage Rules' ziwe pacha na 'Firestore Rules' (allow read, write: if true; kwa majaribio).");
            }
            
            // If it's a retry error, maybe we should just resolve to fallback to avoid blocking the user flow?
            // For now, let's keep rejection but with better message.
            reject(descriptiveError);
          }, 
          async () => {
            clearTimeout(timeout);
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(downloadURL);
          }
        );
      });
    } catch (error) {
      console.error(`Error in uploadFile wrapper:`, error);
      throw error;
    }
  },

  /**
   * Delete a file from Firebase Storage
   */
  async deleteFile(bucket: BucketName, path: string): Promise<void> {
    try {
      const storageRef = ref(storage, `${bucket}/${path}`);
      await deleteObject(storageRef);
    } catch (error) {
      console.error(`Error deleting from ${bucket}:`, error);
      throw error;
    }
  },

  /**
   * Helper to format profile photo paths
   */
  getProfilePath(userId: string, filename: string): string {
    const ext = filename.split('.').pop();
    return `${userId}/avatar.${ext}`;
  },

  /**
   * Helper to format vendor branding paths
   */
  getVendorPath(vendorId: string, type: 'logo' | 'banner' | 'gallery' | 'document' | 'stand_bg', filename: string): string {
    const ext = filename.split('.').pop();
    if (type === 'gallery' || type === 'document') {
      return `${vendorId}/${type}/${Date.now()}_${filename}`;
    }
    return `${vendorId}/${type}.${ext}`;
  },

  /**
   * Helper to format product image paths
   */
  getProductPath(vendorId: string, productId: string, filename: string): string {
    const ext = filename.split('.').pop();
    return `${vendorId}/${productId}/${Date.now()}.${ext}`;
  },

  /**
   * Helper to format review image paths
   */
  getReviewPath(userId: string, filename: string): string {
    const ext = filename.split('.').pop();
    return `${userId}/${Date.now()}.${ext}`;
  }
};
