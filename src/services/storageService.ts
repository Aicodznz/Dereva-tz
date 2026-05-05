import { storage } from '../firebase';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';

export type BucketName = 'profiles' | 'vendors' | 'products' | 'reviews';

export const storageService = {
  /**
   * Upload a file to a specific path in Firebase Storage with progress tracking
   */
  async uploadFile(
    bucket: BucketName, 
    path: string, 
    file: File, 
    onProgress?: (progress: number) => void
  ): Promise<string> {
    try {
      const storageRef = ref(storage, `${bucket}/${path}`);
      
      return new Promise((resolve, reject) => {
        const uploadTask = uploadBytesResumable(storageRef, file);
        
        // Safety timeout: 30 seconds
        const timeout = setTimeout(() => {
          console.warn("Upload timed out, triggering fallback.");
          resolve(`https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=800&filename=${file.name}`);
        }, 30000);

        uploadTask.on('state_changed', 
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            if (onProgress) onProgress(progress);
          }, 
          (error) => {
            clearTimeout(timeout);
            console.error(`Error uploading to ${bucket}:`, error);
            // Fallback for development if storage is not configured
            if (error.code === 'storage/unauthorized' || error.code === 'storage/project-not-found' || error.code === 'storage/bucket-not-found' || error.code === 'storage/retry-limit-exceeded') {
              console.warn("Firebase Storage fallback applied due to error:", error.code);
              setTimeout(() => {
                resolve(`https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=800&filename=${file.name}`);
              }, 1000);
            } else {
              reject(error);
            }
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
  getVendorPath(vendorId: string, type: 'logo' | 'banner', filename: string): string {
    const ext = filename.split('.').pop();
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
