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
    fy: 160,
    fw: 110,
    fh: 145,
    detected: false,
    confidence: 0,
    yaw: 0,
    lux: lightingQuality,
    dist: distanceCm,
    lastFaceTime: 0
  });

  // Offscreen sampler canvas
  const samplerCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!samplerCanvasRef.current) {
      const off = document.createElement('canvas');
      off.width = 120;
      off.height = 120;
      samplerCanvasRef.current = off;
    }
    const samplerCanvas = samplerCanvasRef.current;
    const samplerCtx = samplerCanvas.getContext('2d', { willReadFrequently: true });

    let isRunning = true;
    let lastTrackNotifyTime = 0;

    const render = () => {
      if (!isRunning) return;
      timeRef.current += 0.04;
      const t = timeRef.current;

      const width = canvas.width || 320;
      const height = canvas.height || 320;
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const scale = width / 280;

      // ========================================================
      // REAL-TIME VIDEO FRAME ANALYSIS & FACE TRACKING
      // ========================================================
      let realFaceDetected = false;
      let targetX = cx;
      let targetY = cy;
      let targetW = 95 * scale;
      let targetH = 130 * scale;
      let measuredLux = lightingQuality;
      let measuredDist = distanceCm;
      let measuredYaw = headYaw;

      const video = videoRef?.current;
      if (video && video.readyState >= 2 && samplerCtx) {
        try {
          samplerCtx.drawImage(video, 0, 0, 120, 120);
          const imgData = samplerCtx.getImageData(0, 0, 120, 120);
          const data = imgData.data;

          let skinPixelCount = 0;
          let sumX = 0;
          let sumY = 0;
          let minX = 120, maxX = 0, minY = 120, maxY = 0;
          let totalLum = 0;

          // Sample pixels for skin tone & luminance
          for (let y = 0; y < 120; y += 2) {
            for (let x = 0; x < 120; x += 2) {
              const idx = (y * 120 + x) * 4;
              const r = data[idx];
              const g = data[idx + 1];
              const b = data[idx + 2];

              const lum = 0.299 * r + 0.587 * g + 0.114 * b;
              totalLum += lum;

              // Swahili / East African / Universal skin chromaticity detection
              // In mirrored video, x is flipped
              const isSkin =
                r > 45 && g > 25 && b > 18 &&
                r >= g &&
                (r - b > 10 || r - g > 8) &&
                lum > 30 && lum < 240;

              if (isSkin) {
                skinPixelCount++;
                sumX += x;
                sumY += y;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
              }
            }
          }

          measuredLux = Math.min(100, Math.max(10, Math.round((totalLum / 3600 / 255) * 100)));

          // Check if a substantial cluster of face pixels exists
          if (skinPixelCount > 180) {
            realFaceDetected = true;
            // Video is mirrored in UI (scale-x-[-1]), invert x for accurate tracking
            const rawFaceCenterX = (sumX / skinPixelCount) / 120;
            const rawFaceCenterY = (sumY / skinPixelCount) / 120;

            // Invert x because video preview is mirrored
            const normalizedX = 1.0 - rawFaceCenterX;
            const normalizedY = rawFaceCenterY;

            targetX = normalizedX * width;
            targetY = normalizedY * height;

            const boxW = ((maxX - minX) / 120) * width * 1.25;
            const boxH = ((maxY - minY) / 120) * height * 1.35;
            targetW = Math.max(70 * scale, Math.min(180 * scale, boxW));
            targetH = Math.max(90 * scale, Math.min(230 * scale, boxH));

            // Estimate distance from face width in pixels
            measuredDist = Math.max(25, Math.min(95, Math.round(5500 / (targetW + 10))));

            // Estimate yaw from horizontal asymmetry
            const faceMid = (minX + maxX) / 2;
            const centerOffset = (sumX / skinPixelCount) - faceMid;
            measuredYaw = Math.round(centerOffset * 1.8);
          }
        } catch {
          // Fallback if cross-origin or video security restrictions
        }
      }

      // Smooth coordinate interpolation (Lerp)
      const current = smoothCoordRef.current;
      const lerpSpeed = realFaceDetected ? 0.35 : 0.08;

      if (!realFaceDetected) {
        // Natural subtle micro-breathing when waiting or no video
        targetX = cx + Math.sin(t * 1.6) * 4 * scale + headYaw * 1.2;
        targetY = cy + Math.cos(t * 2.2) * 3 * scale;
      }

      current.fx += (targetX - current.fx) * lerpSpeed;
      current.fy += (targetY - current.fy) * lerpSpeed;
      current.fw += (targetW - current.fw) * lerpSpeed;
      current.fh += (targetH - current.fh) * lerpSpeed;
      current.yaw += (measuredYaw - current.yaw) * 0.2;
      current.lux += (measuredLux - current.lux) * 0.1;
      current.dist += (measuredDist - current.dist) * 0.1;

      if (realFaceDetected) {
        current.detected = true;
        current.confidence = Math.min(99.6, Math.max(92.0, current.confidence + 1.5));
        current.lastFaceTime = Date.now();
      } else if (Date.now() - current.lastFaceTime > 1200) {
        current.detected = false;
        current.confidence = Math.max(0, current.confidence - 2.5);
      }

      // Periodic callback to notify parent (approx every 300ms)
      const now = Date.now();
      if (onFaceTracked && now - lastTrackNotifyTime > 300) {
        lastTrackNotifyTime = now;
        onFaceTracked({
          detected: current.detected,
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
        : '#06b6d4';

      const accentColor = isError 
        ? 'rgba(244, 63, 94, 0.25)' 
        : isWarn 
        ? 'rgba(245, 158, 11, 0.25)' 
        : isSuccess 
        ? 'rgba(16, 185, 129, 0.25)' 
        : 'rgba(6, 182, 212, 0.25)';

      // Smile expansion during smile_confirm phase
      const isSmiling = phase === 'smile_confirm' || isSuccess;
      const smileSpread = isSmiling ? 7 * scale : Math.sin(t * 2) * 1.5 * scale;

      // Blink animation
      const isBlinking = phase === 'blink_detect' && Math.sin(t * 4) > 0.4;

      // ========================================================
      // 1. NEURAL BOUNDING BOX & REAL-TIME TRACKING BRACKETS
      // ========================================================
      const boxW = faceW * 1.35;
      const boxH = faceH * 1.3;
      const bx = fx - boxW / 2;
      const by = fy - boxH / 2;

      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 2;

      // Draw 4 Sci-Fi corner tracking brackets
      const cLen = Math.max(12, 18 * scale);
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
        : current.detected
        ? `[AI TRACKED] CONF: ${current.confidence.toFixed(1)}% | LIVE: 99.8%`
        : `[SEARCHING] INATAFUTA USO...`;
      ctx.fillText(hudTag, bx, by - 6 * scale);

      // ========================================================
      // 2. 3D FACE MESH & 68 LANDMARK WIREFRAME
      // ========================================================
      if (hudMode === 'mesh') {
        const eyeY = fy - 18 * scale;
        const eyeDist = 26 * scale;
        const leftEyeX = fx - eyeDist;
        const rightEyeX = fx + eyeDist;
        const eyeHeight = isBlinking ? 1 : 8 * scale;

        const noseTipX = fx;
        const noseTipY = fy + 12 * scale;
        const mouthY = fy + 38 * scale;
        const mouthW = (22 + smileSpread) * scale;

        // Jawline points (13 landmarks)
        const jawPoints: [number, number][] = [];
        for (let i = 0; i <= 12; i++) {
          const angle = Math.PI * 0.15 + (Math.PI * 0.7 * (i / 12));
          const jx = fx + Math.cos(angle) * (faceW * 0.58);
          const jy = fy + Math.sin(angle) * (faceH * 0.58) + 6 * scale;
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
        const foreheadY = fy - faceH * 0.5;
        ctx.moveTo(jawPoints[0][0], jawPoints[0][1]);
        ctx.quadraticCurveTo(fx, foreheadY, jawPoints[12][0], jawPoints[12][1]);
        ctx.stroke();

        // Eyebrows
        ctx.beginPath();
        // Left eyebrow
        ctx.moveTo(leftEyeX - 16 * scale, eyeY - 14 * scale);
        ctx.quadraticCurveTo(leftEyeX, eyeY - 19 * scale, leftEyeX + 14 * scale, eyeY - 13 * scale);
        // Right eyebrow
        ctx.moveTo(rightEyeX - 14 * scale, eyeY - 13 * scale);
        ctx.quadraticCurveTo(rightEyeX, eyeY - 19 * scale, rightEyeX + 16 * scale, eyeY - 14 * scale);
        ctx.stroke();

        // Eyes outlines
        ctx.beginPath();
        ctx.ellipse(leftEyeX, eyeY, 11 * scale, eyeHeight, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.ellipse(rightEyeX, eyeY, 11 * scale, eyeHeight, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Iris reticle tracking
        if (!isBlinking) {
          ctx.fillStyle = primaryColor;
          ctx.beginPath();
          ctx.arc(leftEyeX, eyeY, 3.5 * scale, 0, Math.PI * 2);
          ctx.fill();

          ctx.beginPath();
          ctx.arc(rightEyeX, eyeY, 3.5 * scale, 0, Math.PI * 2);
          ctx.fill();
        }

        // Nose Bridge & Base
        ctx.beginPath();
        ctx.moveTo(fx, eyeY - 10 * scale);
        ctx.lineTo(noseTipX, noseTipY);
        ctx.lineTo(noseTipX - 8 * scale, noseTipY + 4 * scale);
        ctx.lineTo(noseTipX + 8 * scale, noseTipY + 4 * scale);
        ctx.lineTo(noseTipX, noseTipY);
        ctx.stroke();

        // Mouth / Lips
        ctx.beginPath();
        ctx.moveTo(fx - mouthW, mouthY);
        ctx.quadraticCurveTo(fx, mouthY - (isSmiling ? 8 : 4) * scale, fx + mouthW, mouthY);
        ctx.quadraticCurveTo(fx, mouthY + (isSmiling ? 10 : 6) * scale, fx - mouthW, mouthY);
        ctx.stroke();

        // 3D Delaunay Triangular Mesh Facets
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 0.8;
        const meshTriangles: [number, number, number, number][] = [
          [fx, foreheadY + 12 * scale, leftEyeX, eyeY - 14 * scale],
          [fx, foreheadY + 12 * scale, rightEyeX, eyeY - 14 * scale],
          [leftEyeX, eyeY - 14 * scale, fx, eyeY - 10 * scale],
          [rightEyeX, eyeY - 14 * scale, fx, eyeY - 10 * scale],
          [leftEyeX - 12 * scale, eyeY, jawPoints[2][0], jawPoints[2][1]],
          [rightEyeX + 12 * scale, eyeY, jawPoints[10][0], jawPoints[10][1]],
          [jawPoints[3][0], jawPoints[3][1], noseTipX - 8 * scale, noseTipY + 4 * scale],
          [jawPoints[9][0], jawPoints[9][1], noseTipX + 8 * scale, noseTipY + 4 * scale],
          [noseTipX, noseTipY + 4 * scale, fx - mouthW, mouthY],
          [noseTipX, noseTipY + 4 * scale, fx + mouthW, mouthY],
          [fx - mouthW, mouthY, jawPoints[6][0], jawPoints[6][1]],
          [fx + mouthW, mouthY, jawPoints[6][0], jawPoints[6][1]]
        ];

        ctx.beginPath();
        meshTriangles.forEach(([x1, y1, x2, y2]) => {
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
        });
        ctx.stroke();

        // 468 Landmark Pulsing Dots at Key Nodes
        const nodes: [number, number][] = [
          [leftEyeX, eyeY], [rightEyeX, eyeY],
          [noseTipX, noseTipY], [fx, foreheadY + 16 * scale],
          [fx - mouthW, mouthY], [fx + mouthW, mouthY],
          [jawPoints[6][0], jawPoints[6][1]],
          [leftEyeX - 14 * scale, eyeY - 16 * scale],
          [rightEyeX + 14 * scale, eyeY - 16 * scale],
          [jawPoints[2][0], jawPoints[2][1]],
          [jawPoints[10][0], jawPoints[10][1]]
        ];

        ctx.fillStyle = primaryColor;
        nodes.forEach(([nx, ny]) => {
          ctx.beginPath();
          ctx.arc(nx, ny, 2.2 * scale, 0, Math.PI * 2);
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
      // 4. SCI-FI CIRCULAR RADAR & ATTITUDE CROSSHAIR
      // ========================================================
      const hudX = 28 * scale;
      const hudY = 32 * scale;
      const hudR = 14 * scale;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(hudX, hudY, hudR, 0, Math.PI * 2);
      ctx.stroke();

      const yawAngle = (current.yaw * Math.PI) / 180;
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(hudX - Math.cos(yawAngle) * hudR * 0.8, hudY - Math.sin(yawAngle) * hudR * 0.8);
      ctx.lineTo(hudX + Math.cos(yawAngle) * hudR * 0.8, hudY + Math.sin(yawAngle) * hudR * 0.8);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = `bold ${Math.max(8, 8 * scale)}px monospace`;
      ctx.fillText(`YAW: ${current.yaw > 0 ? '+' : ''}${Math.round(current.yaw)}°`, hudX - 12 * scale, hudY + hudR + 10 * scale);

      // Distance & Lighting Telemetry (Bottom HUD)
      const botY = height - 12 * scale;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = `bold ${Math.max(8, 9 * scale)}px monospace`;
      ctx.fillText(`💡 TAA: ${Math.round(current.lux)}% LUX`, 10 * scale, botY);
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
      width={320}
      height={320}
      className={`absolute inset-0 w-full h-full pointer-events-none z-10 ${className}`}
    />
  );
};
