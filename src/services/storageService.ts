import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

export type BucketName = 'profiles' | 'vendors' | 'products' | 'reviews';

export const storageService = {
  /**
   * Upload a file to a specific path in Firebase Storage
   */
  async uploadFile(bucket: BucketName, path: string, file: File): Promise<string> {
    try {
      const storageRef = ref(storage, `${bucket}/${path}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      return downloadURL;
    } catch (error) {
      console.error(`Error uploading to ${bucket}:`, error);
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
