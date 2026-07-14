import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  
  // Custom parsing of .env file to ensure local .env file overrides process.env
  let localCloudName = '';
  let localUploadPreset = '';
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const cloudNameMatch = envContent.match(/^VITE_CLOUDINARY_CLOUD_NAME=(.*)$/m);
      const uploadPresetMatch = envContent.match(/^VITE_CLOUDINARY_UPLOAD_PRESET=(.*)$/m);
      if (cloudNameMatch) localCloudName = cloudNameMatch[1].trim();
      if (uploadPresetMatch) localUploadPreset = uploadPresetMatch[1].trim();
    }
  } catch (e) {
    console.error("Error reading local .env file:", e);
  }

  const cloudName = localCloudName || env.VITE_CLOUDINARY_CLOUD_NAME || '';
  const uploadPreset = localUploadPreset || env.VITE_CLOUDINARY_UPLOAD_PRESET || '';

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'import.meta.env.VITE_CLOUDINARY_CLOUD_NAME': JSON.stringify(cloudName),
      'import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET': JSON.stringify(uploadPreset),
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('.', import.meta.url)),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      allowedHosts: true,
    },
  };
});
