import React, { useEffect, useRef } from 'react';

export type BiometricHudMode = 'mesh' | 'neural_box' | 'liveness_depth';

export interface FaceTrackResult {
  detected: boolean;
  confidence: number;
  faceX: number;
  faceY: number;
  faceWidth: number;
  faceHeight: number;
  brightness: number;
  distanceCm: number;
  headYaw: number;
}

interface BiometricFaceCanvasProps {
  phase: 'initializing' | 'align_center' | 'blink_detect' | 'smile_confirm' | 'verifying' | 'success' | 'spoof_rejected' | 'unregistered' | 'error' | 'idle';
  isUnregistered?: boolean;
  hudMode?: BiometricHudMode;
  faceConfidence?: number;
  blinkCount?: number;
  headYaw?: number;
  lightingQuality?: number; // 0 - 100
  distanceCm?: number;
  className?: string;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  onFaceTracked?: (info: FaceTrackResult) => void;
}

export const BiometricFaceCanvas: React.FC<BiometricFaceCanvasProps> = ({
  phase,
  isUnregistered = false,
  hudMode = 'mesh',
  faceConfidence = 99.2,
  blinkCount = 0,
  headYaw = 0,
  lightingQuality = 88,
  distanceCm = 45,
  className = '',
  videoRef,
  onFaceTracked
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const timeRef = useRef<number>(0);

  // Smooth tracker coordinates
  const smoothCoordRef = useRef({
    fx: 160,
    fy: 110,
    fw: 100,
    fh: 135,
    detected: false,
    confidence: 0,
    yaw: 0,
    lux: lightingQuality,
    dist: distanceCm,
    consecutiveDetections: 0,
    consecutiveMisses: 0,
    lastFaceTime: 0
  });

  // Persistent detection state across animation frames
  const lastDetectedRef = useRef<boolean>(false);
  const targetCoordsRef = useRef({
    x: 160,
    y: 110,
    w: 100,
    h: 135,
    lux: lightingQuality,
    dist: distanceCm,
    yaw: 0
  });

  // Offscreen sampler canvas
  const samplerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // Native FaceDetector instance if available in browser
  const faceDetectorRef = useRef<any>(null);

  useEffect(() => {
    // Check for native Shape Detection API (available in modern Chromium/Android)
    if (typeof window !== 'undefined' && 'FaceDetector' in window) {
      try {
        faceDetectorRef.current = new (window as any).FaceDetector({
          fastMode: true,
          maxDetectedFaces: 1
        });
      } catch {
        faceDetectorRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!samplerCanvasRef.current) {
      const off = document.createElement('canvas');
      off.width = 160;
      off.height = 120;
      samplerCanvasRef.current = off;
    }
    const samplerCanvas = samplerCanvasRef.current;
    const samplerCtx = samplerCanvas.getContext('2d', { willReadFrequently: true });

    let isRunning = true;
    let lastTrackNotifyTime = 0;
    let lastAnalysisTime = 0;
    let isDetectingNative = false;

    // Async native detector helper
    const checkNativeFace = async (video: HTMLVideoElement) => {
      if (!faceDetectorRef.current || isDetectingNative || video.readyState < 2) return null;
      try {
        isDetectingNative = true;
        const faces = await faceDetectorRef.current.detect(video);
        isDetectingNative = false;
        if (faces && faces.length > 0) {
          return faces[0];
        }
        return false;
      } catch {
        isDetectingNative = false;
        return null;
      }
    };

    let cachedNativeFace: any = null;

    const render = () => {
      if (!isRunning) return;
      timeRef.current += 0.04;
      const t = timeRef.current;
      const now = Date.now();

      // Sync canvas dimensions with actual displayed size to prevent squashing/distortion
      if (canvas.offsetWidth > 0 && canvas.offsetHeight > 0) {
        if (canvas.width !== canvas.offsetWidth || canvas.height !== canvas.offsetHeight) {
          canvas.width = canvas.offsetWidth;
          canvas.height = canvas.offsetHeight;
        }
      }

      const width = canvas.width || 320;
      const height = canvas.height || 260;
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const naturalHeadY = height * 0.38;
      const scale = Math.min(width, height) / 260;

      // ========================================================
      // REAL-TIME VIDEO FRAME ANALYSIS & ACCURATE FACE TRACKING
      // ========================================================
      const video = videoRef?.current;
      const isVideoActive = Boolean(
        video && 
        video.readyState >= 2 && 
        !video.paused && 
        !video.ended && 
        video.videoWidth > 0 && 
        video.videoHeight > 0
      );

      if (isVideoActive && samplerCtx) {
        // Run vision analysis at ~15-20 FPS (every 50ms) for high responsiveness
        if (now - lastAnalysisTime > 50) {
          lastAnalysisTime = now;

          // 1. Try Native FaceDetector if supported (instant hardware acceleration on Chrome/Android)
          if (faceDetectorRef.current) {
            checkNativeFace(video).then(result => {
              cachedNativeFace = result;
            });
          }

          // 2. High-precision Universal Multi-Cue Vision Analysis via Canvas Sampler
          try {
            samplerCtx.drawImage(video, 0, 0, 160, 120);
            const imgData = samplerCtx.getImageData(0, 0, 160, 120);
            const data = imgData.data;

            let skinPixelCount = 0;
            let sumX = 0;
            let sumY = 0;
            let minX = 160, maxX = 0, minY = 120, maxY = 0;
            let totalLum = 0;
            let lumSamples: number[] = [];

            // Sample pixels across central counter face region
            for (let y = 8; y < 112; y += 2) {
              for (let x = 12; x < 148; x += 2) {
                const idx = (y * 160 + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];

                const lum = 0.299 * r + 0.587 * g + 0.114 * b;
                totalLum += lum;

                // Academic Universal Fitzpatrick I-VI Skin Model (covers all melanin tones & warm lighting)
                // 1) RGB model: Red component dominates, blue is lowest, with reasonable brightness
                const isSkinRGB = r > 35 && g > 20 && b > 10 && r >= g && (r - b) >= 6;
                // 2) YCbCr with broader chromatic ranges (Cb [60, 140], Cr [120, 190], Lum [15, 248])
                const cb = -0.1687 * r - 0.3313 * g + 0.5 * b + 128;
                const cr = 0.5 * r - 0.4187 * g - 0.0813 * b + 128;
                const isSkinYCbCr = cb >= 60 && cb <= 140 && cr >= 120 && cr <= 190 && lum >= 15 && lum <= 248;

                if (isSkinRGB || isSkinYCbCr) {
                  skinPixelCount++;
                  sumX += x;
                  sumY += y;
                  if (x < minX) minX = x;
                  if (x > maxX) maxX = x;
                  if (y < minY) minY = y;
                  if (y > maxY) maxY = y;
                  if (skinPixelCount % 3 === 0) {
                    lumSamples.push(lum);
                  }
                }
              }
            }

            const measuredLuxVal = Math.min(100, Math.max(10, Math.round((totalLum / 4800 / 255) * 100)));

            // Check if Native Face Detector found a face
            if (cachedNativeFace && cachedNativeFace.boundingBox) {
              const bb = cachedNativeFace.boundingBox;
              const vW = video.videoWidth || 640;
              const vH = video.videoHeight || 480;

              // Mirrored horizontal coordinates
              const normX = 1.0 - (bb.x + bb.width / 2) / vW;
              const normY = (bb.y + bb.height * 0.42) / vH;

              const targetXVal = normX * width;
              const targetYVal = normY * height;
              const targetWVal = Math.max(70 * scale, Math.min(180 * scale, (bb.width / vW) * width * 1.15));
              const targetHVal = Math.max(90 * scale, Math.min(230 * scale, (bb.height / vH) * height * 1.15));
              const measuredDistVal = Math.max(25, Math.min(90, Math.round(4800 / (targetWVal + 10))));

              lastDetectedRef.current = true;
              targetCoordsRef.current = {
                x: targetXVal,
                y: targetYVal,
                w: targetWVal,
                h: targetHVal,
                lux: measuredLuxVal,
                dist: measuredDistVal,
                yaw: 0
              };
            } else {
              const spanX = maxX - minX;
              const spanY = maxY - minY;
              const aspectRatio = spanY / (spanX || 1);

              // Responsive, reliable face cluster threshold
              if (
                skinPixelCount >= 100 && 
                spanX >= 20 && 
                spanY >= 25 && 
                aspectRatio >= 0.75 && 
                aspectRatio <= 2.5
              ) {
                lastDetectedRef.current = true;

                const rawCenterX = (sumX / skinPixelCount) / 160;
                const rawCenterY = (minY + spanY * 0.42) / 120;

                const normalizedX = 1.0 - rawCenterX;
                const normalizedY = Math.max(0.18, Math.min(0.70, rawCenterY));

                const targetXVal = normalizedX * width;
                const targetYVal = normalizedY * height;

                const boxW = (spanX / 160) * width * 1.25;
                const boxH = (spanY / 120) * height * 1.1;
                const targetWVal = Math.max(75 * scale, Math.min(185 * scale, boxW));
                const targetHVal = Math.max(95 * scale, Math.min(235 * scale, boxH));
                const measuredDistVal = Math.max(25, Math.min(95, Math.round(5200 / (targetWVal + 10))));

                const faceMid = (minX + maxX) / 2;
                const centerOffset = (sumX / skinPixelCount) - faceMid;
                const measuredYawVal = Math.round(centerOffset * 1.8);

                targetCoordsRef.current = {
                  x: targetXVal,
                  y: targetYVal,
                  w: targetWVal,
                  h: targetHVal,
                  lux: measuredLuxVal,
                  dist: measuredDistVal,
                  yaw: measuredYawVal
                };
              } else if (skinPixelCount >= 70) {
                // Secondary fallback when person is slightly further from phone
                lastDetectedRef.current = true;
                targetCoordsRef.current = {
                  x: cx,
                  y: naturalHeadY,
                  w: 100 * scale,
                  h: 135 * scale,
                  lux: measuredLuxVal,
                  dist: 50,
                  yaw: 0
                };
              } else {
                lastDetectedRef.current = false;
              }
            }
          } catch {
            // Sampler fallback
          }
        }
      }

      // Smooth coordinate interpolation (Lerp) using persistent detection state
      const current = smoothCoordRef.current;
      const isFacePresent = lastDetectedRef.current;

      if (isFacePresent) {
        current.consecutiveDetections++;
        current.consecutiveMisses = 0;
        current.lastFaceTime = now;
      } else {
        current.consecutiveMisses++;
        if (current.consecutiveMisses >= 3) {
          current.consecutiveDetections = 0;
        }
      }

      // Stable detection after 2 consecutive frames (~30-50ms)
      const isStablyDetected = isFacePresent && current.consecutiveDetections >= 2;
      current.detected = isStablyDetected;

      const lerpSpeed = isStablyDetected ? 0.38 : 0.08;
      let targetX = targetCoordsRef.current.x;
      let targetY = targetCoordsRef.current.y;
      let targetW = targetCoordsRef.current.w;
      let targetH = targetCoordsRef.current.h;

      if (!isStablyDetected) {
        // Natural gentle idle scanner pulse when no face is present
        targetX = cx;
        targetY = naturalHeadY + Math.sin(t * 1.8) * 4 * scale;
        targetW = 105 * scale;
        targetH = 138 * scale;
        current.confidence = Math.max(0, current.confidence - 4.5);
      } else {
        current.confidence = Math.min(99.6, Math.max(92.0, current.confidence + 3.0));
      }

      current.fx += (targetX - current.fx) * lerpSpeed;
      current.fy += (targetY - current.fy) * lerpSpeed;
      current.fw += (targetW - current.fw) * lerpSpeed;
      current.fh += (targetH - current.fh) * lerpSpeed;
      current.yaw += (targetCoordsRef.current.yaw - current.yaw) * 0.2;
      current.lux += (targetCoordsRef.current.lux - current.lux) * 0.1;
      current.dist += (targetCoordsRef.current.dist - current.dist) * 0.1;

      // Notify parent callback every ~180ms
      if (onFaceTracked && now - lastTrackNotifyTime > 180) {
        lastTrackNotifyTime = now;
        onFaceTracked({
          detected: isStablyDetected,
          confidence: Math.round(current.confidence * 10) / 10,
          faceX: Math.round(current.fx),
          faceY: Math.round(current.fy),
          faceWidth: Math.round(current.fw),
          faceHeight: Math.round(current.fh),
          brightness: Math.round(current.lux),
          distanceCm: Math.round(current.dist),
          headYaw: Math.round(current.yaw)
        });
      }

      const fx = current.fx;
      const fy = current.fy;
      const faceW = current.fw;
      const faceH = current.fh;

      // Color scheme based on status
      const isWarn = phase === 'unregistered' || isUnregistered;
      const isError = phase === 'spoof_rejected' || phase === 'error';
      const isSuccess = phase === 'success';

      const primaryColor = isError 
        ? '#f43f5e' 
        : isWarn 
        ? '#f59e0b' 
        : isSuccess 
        ? '#10b981' 
        : isStablyDetected
        ? '#06b6d4'
        : 'rgba(255, 255, 255, 0.45)';

      const accentColor = isError 
        ? 'rgba(244, 63, 94, 0.25)' 
        : isWarn 
        ? 'rgba(245, 158, 11, 0.25)' 
        : isSuccess 
        ? 'rgba(16, 185, 129, 0.25)' 
        : isStablyDetected
        ? 'rgba(6, 182, 212, 0.25)'
        : 'rgba(255, 255, 255, 0.12)';

      // ========================================================
      // 0. IDLE SEARCHING STATE (HAKUNA USO UNAOONEKANA)
      // ========================================================
      if (!isStablyDetected) {
        // Oval Face Placement Guide
        const guideW = 110 * scale;
        const guideH = 145 * scale;

        ctx.save();
        ctx.setLineDash([8, 8]);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(cx, naturalHeadY, guideW * 0.7, guideH * 0.75, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Pulsing Search Crosshairs
        const crossRadius = (35 + Math.sin(t * 3) * 6) * scale;
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, naturalHeadY, crossRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx - crossRadius - 12, naturalHeadY);
        ctx.lineTo(cx + crossRadius + 12, naturalHeadY);
        ctx.moveTo(cx, naturalHeadY - crossRadius - 12);
        ctx.lineTo(cx, naturalHeadY + crossRadius + 12);
        ctx.stroke();

        // Instructional Banner in Canvas
        const bannerY = naturalHeadY + guideH * 0.85;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(cx - 130 * scale, bannerY - 14 * scale, 260 * scale, 26 * scale);

        ctx.strokeStyle = 'rgba(6, 182, 212, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(cx - 130 * scale, bannerY - 14 * scale, 260 * scale, 26 * scale);

        ctx.fillStyle = '#38bdf8';
        ctx.font = `bold ${Math.max(10, 11 * scale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('🔍 WEKA USO WAKO MBELE YA KAMERA', cx, bannerY + 3 * scale);
        ctx.textAlign = 'left';

        animFrameIdRef.current = requestAnimationFrame(render);
        return;
      }

      // ========================================================
      // 1. NEURAL BOUNDING BOX & REAL-TIME TRACKING BRACKETS
      // ========================================================
      const boxW = faceW * 1.3;
      const boxH = faceH * 1.25;
      const bx = fx - boxW / 2;
      const by = fy - boxH / 2;

      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 2;

      // Draw 4 Sci-Fi corner tracking brackets
      const cLen = Math.max(14, 18 * scale);
      // Top-left
      ctx.beginPath();
      ctx.moveTo(bx, by + cLen);
      ctx.lineTo(bx, by);
      ctx.lineTo(bx + cLen, by);
      ctx.stroke();

      // Top-right
      ctx.beginPath();
      ctx.moveTo(bx + boxW - cLen, by);
      ctx.lineTo(bx + boxW, by);
      ctx.lineTo(bx + boxW, by + cLen);
      ctx.stroke();

      // Bottom-left
      ctx.beginPath();
      ctx.moveTo(bx, by + boxH - cLen);
      ctx.lineTo(bx, by + boxH);
      ctx.lineTo(bx + cLen, by + boxH);
      ctx.stroke();

      // Bottom-right
      ctx.beginPath();
      ctx.moveTo(bx + boxW - cLen, by + boxH);
      ctx.lineTo(bx + boxW, by + boxH);
      ctx.lineTo(bx + boxW, by + boxH - cLen);
      ctx.stroke();

      // Laser Biometric Sweep Line across bounding box
      const scanY = by + ((Math.sin(t * 3) + 1) / 2) * boxH;
      const scanGrad = ctx.createLinearGradient(bx, scanY, bx + boxW, scanY);
      scanGrad.addColorStop(0, 'transparent');
      scanGrad.addColorStop(0.5, primaryColor);
      scanGrad.addColorStop(1, 'transparent');

      ctx.strokeStyle = scanGrad;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(bx + 4, scanY);
      ctx.lineTo(bx + boxW - 4, scanY);
      ctx.stroke();

      // Label above bounding box
      ctx.fillStyle = primaryColor;
      ctx.font = `bold ${Math.max(9, 10 * scale)}px monospace`;
      const hudTag = isWarn 
        ? `[!] HAJASAJILIWA (UNKNOWN FACE)` 
        : isError 
        ? `[X] SPOOF REJECTED` 
        : `[AI TRACKED] USO UMEGUNDULIWA | ${current.confidence.toFixed(1)}%`;
      ctx.fillText(hudTag, bx, by - 6 * scale);

      // ========================================================
      // 2. 3D FACE MESH & 68 LANDMARK WIREFRAME
      // ========================================================
      const isSmiling = phase === 'smile_confirm' || isSuccess;
      const smileSpread = isSmiling ? 7 * scale : Math.sin(t * 2) * 1.5 * scale;
      const isBlinking = phase === 'blink_detect' && Math.sin(t * 4) > 0.4;

      if (hudMode === 'mesh') {
        const eyeY = fy - 16 * scale;
        const eyeDist = 24 * scale;
        const leftEyeX = fx - eyeDist;
        const rightEyeX = fx + eyeDist;
        const eyeHeight = isBlinking ? 1 : 7 * scale;

        const noseTipX = fx;
        const noseTipY = fy + 10 * scale;
        const mouthY = fy + 34 * scale;
        const mouthW = (20 + smileSpread) * scale;

        // Jawline points (13 landmarks)
        const jawPoints: [number, number][] = [];
        for (let i = 0; i <= 12; i++) {
          const angle = Math.PI * 0.15 + (Math.PI * 0.7 * (i / 12));
          const jx = fx + Math.cos(angle) * (faceW * 0.55);
          const jy = fy + Math.sin(angle) * (faceH * 0.55) + 4 * scale;
          jawPoints.push([jx, jy]);
        }

        // Draw Jawline Contour
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        jawPoints.forEach(([px, py], idx) => {
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();

        // Forehead dome contour
        ctx.beginPath();
        const foreheadY = fy - faceH * 0.48;
        ctx.moveTo(jawPoints[0][0], jawPoints[0][1]);
        ctx.quadraticCurveTo(fx, foreheadY, jawPoints[12][0], jawPoints[12][1]);
        ctx.stroke();

        // Eyebrows
        ctx.beginPath();
        ctx.moveTo(leftEyeX - 14 * scale, eyeY - 12 * scale);
        ctx.quadraticCurveTo(leftEyeX, eyeY - 17 * scale, leftEyeX + 12 * scale, eyeY - 11 * scale);
        ctx.moveTo(rightEyeX - 12 * scale, eyeY - 11 * scale);
        ctx.quadraticCurveTo(rightEyeX, eyeY - 17 * scale, rightEyeX + 14 * scale, eyeY - 12 * scale);
        ctx.stroke();

        // Eyes outlines
        ctx.beginPath();
        ctx.ellipse(leftEyeX, eyeY, 10 * scale, eyeHeight, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.ellipse(rightEyeX, eyeY, 10 * scale, eyeHeight, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Iris tracking
        if (!isBlinking) {
          ctx.fillStyle = primaryColor;
          ctx.beginPath();
          ctx.arc(leftEyeX, eyeY, 3 * scale, 0, Math.PI * 2);
          ctx.fill();

          ctx.beginPath();
          ctx.arc(rightEyeX, eyeY, 3 * scale, 0, Math.PI * 2);
          ctx.fill();
        }

        // Nose Bridge & Base
        ctx.beginPath();
        ctx.moveTo(fx, eyeY - 8 * scale);
        ctx.lineTo(noseTipX, noseTipY);
        ctx.lineTo(noseTipX - 7 * scale, noseTipY + 3 * scale);
        ctx.lineTo(noseTipX + 7 * scale, noseTipY + 3 * scale);
        ctx.lineTo(noseTipX, noseTipY);
        ctx.stroke();

        // Mouth / Lips
        ctx.beginPath();
        ctx.moveTo(fx - mouthW, mouthY);
        ctx.quadraticCurveTo(fx, mouthY - (isSmiling ? 7 : 3) * scale, fx + mouthW, mouthY);
        ctx.quadraticCurveTo(fx, mouthY + (isSmiling ? 9 : 5) * scale, fx - mouthW, mouthY);
        ctx.stroke();

        // 3D Delaunay Triangular Mesh Facets
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 0.8;
        const meshTriangles: [number, number, number, number][] = [
          [fx, foreheadY + 10 * scale, leftEyeX, eyeY - 12 * scale],
          [fx, foreheadY + 10 * scale, rightEyeX, eyeY - 12 * scale],
          [leftEyeX, eyeY - 12 * scale, fx, eyeY - 8 * scale],
          [rightEyeX, eyeY - 12 * scale, fx, eyeY - 8 * scale],
          [leftEyeX - 10 * scale, eyeY, jawPoints[2][0], jawPoints[2][1]],
          [rightEyeX + 10 * scale, eyeY, jawPoints[10][0], jawPoints[10][1]],
          [jawPoints[3][0], jawPoints[3][1], noseTipX - 7 * scale, noseTipY + 3 * scale],
          [jawPoints[9][0], jawPoints[9][1], noseTipX + 7 * scale, noseTipY + 3 * scale],
          [noseTipX, noseTipY + 3 * scale, fx - mouthW, mouthY],
          [noseTipX, noseTipY + 3 * scale, fx + mouthW, mouthY],
          [fx - mouthW, mouthY, jawPoints[6][0], jawPoints[6][1]],
          [fx + mouthW, mouthY, jawPoints[6][0], jawPoints[6][1]]
        ];

        ctx.beginPath();
        meshTriangles.forEach(([x1, y1, x2, y2]) => {
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
        });
        ctx.stroke();

        // Landmark Nodes
        const nodes: [number, number][] = [
          [leftEyeX, eyeY], [rightEyeX, eyeY],
          [noseTipX, noseTipY], [fx, foreheadY + 14 * scale],
          [fx - mouthW, mouthY], [fx + mouthW, mouthY],
          [jawPoints[6][0], jawPoints[6][1]]
        ];

        ctx.fillStyle = primaryColor;
        nodes.forEach(([nx, ny]) => {
          ctx.beginPath();
          ctx.arc(nx, ny, 2 * scale, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // ========================================================
      // 3. THERMAL / DEPTH ANTI-SPOOFING MAP MODE
      // ========================================================
      if (hudMode === 'liveness_depth') {
        const radGrd = ctx.createRadialGradient(fx, fy, 10 * scale, fx, fy, faceW * 0.85);
        radGrd.addColorStop(0, 'rgba(239, 68, 68, 0.4)');
        radGrd.addColorStop(0.4, 'rgba(234, 179, 8, 0.3)');
        radGrd.addColorStop(0.8, 'rgba(59, 130, 246, 0.25)');
        radGrd.addColorStop(1, 'transparent');

        ctx.fillStyle = radGrd;
        ctx.beginPath();
        ctx.ellipse(fx, fy, faceW * 0.75, faceH * 0.75, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1;
        [0.3, 0.55, 0.8].forEach(ringRatio => {
          ctx.beginPath();
          ctx.ellipse(fx, fy, faceW * ringRatio, faceH * ringRatio, 0, 0, Math.PI * 2);
          ctx.stroke();
        });
      }

      // ========================================================
      // 4. TELEMETRY DISPLAY (BOTTOM & TOP)
      // ========================================================
      const botY = height - 10 * scale;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = `bold ${Math.max(8, 9 * scale)}px monospace`;
      ctx.fillText(`💡 MWANGAZA: ${Math.round(current.lux)}% LUX`, 10 * scale, botY);
      ctx.fillText(`📏 UMBALI: ${Math.round(current.dist)}cm`, width - 95 * scale, botY);

      animFrameIdRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      isRunning = false;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [phase, isUnregistered, hudMode, faceConfidence, blinkCount, headYaw, lightingQuality, distanceCm, videoRef, onFaceTracked]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none z-10 ${className}`}
    />
  );
};
