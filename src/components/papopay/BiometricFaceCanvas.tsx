import React, { useEffect, useRef } from 'react';

export type BiometricHudMode = 'mesh' | 'neural_box' | 'liveness_depth';

interface BiometricFaceCanvasProps {
  phase: 'initializing' | 'align_center' | 'blink_detect' | 'smile_confirm' | 'verifying' | 'success' | 'spoof_rejected' | 'unregistered' | 'error';
  isUnregistered?: boolean;
  hudMode?: BiometricHudMode;
  faceConfidence?: number;
  blinkCount?: number;
  headYaw?: number;
  lightingQuality?: number; // 0 - 100
  distanceCm?: number;
  className?: string;
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
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const timeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;

    const render = () => {
      if (!isRunning) return;
      timeRef.current += 0.04;
      const t = timeRef.current;

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const scale = width / 280;

      // Color scheme based on status
      const isWarn = phase === 'unregistered' || isUnregistered;
      const isError = phase === 'spoof_rejected';
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

      // Simulated micro-movements of live person
      const wobbleX = Math.sin(t * 1.5) * 3 * scale + headYaw * 1.2;
      const wobbleY = Math.cos(t * 2.1) * 2.5 * scale;
      const faceW = 100 * scale;
      const faceH = 135 * scale;
      const fx = cx + wobbleX;
      const fy = cy + wobbleY - 6 * scale;

      // Smile expansion during smile_confirm phase
      const isSmiling = phase === 'smile_confirm' || isSuccess;
      const smileSpread = isSmiling ? 7 * scale : Math.sin(t * 2) * 1.5 * scale;

      // Blink animation
      const isBlinking = phase === 'blink_detect' && Math.sin(t * 4) > 0.4;

      // ========================================================
      // 1. NEURAL BOUNDING BOX MODE & CORNERS
      // ========================================================
      if (hudMode === 'neural_box' || hudMode === 'mesh') {
        const boxW = faceW * 1.35;
        const boxH = faceH * 1.3;
        const bx = fx - boxW / 2;
        const by = fy - boxH / 2;

        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 1.5;

        // Draw 4 Sci-Fi corner brackets
        const cLen = 16 * scale;
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

        // Label above bounding box
        ctx.fillStyle = primaryColor;
        ctx.font = `bold ${Math.max(9, 10 * scale)}px monospace`;
        const hudTag = isWarn 
          ? `[!] HAJASAJILIWA (UNKNOWN)` 
          : isError 
          ? `[X] SPOOF DETECTED` 
          : `[AI] FACE: ${(faceConfidence).toFixed(1)}% | LIVE: 99.8%`;
        ctx.fillText(hudTag, bx, by - 6 * scale);
      }

      // ========================================================
      // 2. 3D FACE MESH & 68 LANDMARK WIREFRAME
      // ========================================================
      if (hudMode === 'mesh') {
        // Define key biometric landmark coordinate offsets relative to (fx, fy)
        const eyeY = fy - 18 * scale;
        const eyeDist = 28 * scale;
        const leftEyeX = fx - eyeDist;
        const rightEyeX = fx + eyeDist;
        const eyeHeight = isBlinking ? 1 : 8 * scale;

        const noseTipX = fx;
        const noseTipY = fy + 12 * scale;
        const mouthY = fy + 38 * scale;
        const mouthW = (24 + smileSpread) * scale;

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
        // Left Eye
        ctx.beginPath();
        ctx.ellipse(leftEyeX, eyeY, 12 * scale, eyeHeight, 0, 0, Math.PI * 2);
        ctx.stroke();
        // Right Eye
        ctx.beginPath();
        ctx.ellipse(rightEyeX, eyeY, 12 * scale, eyeHeight, 0, 0, Math.PI * 2);
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

        // 3D Delaunay Triangular Mesh Facets (connecting forehead, cheek, nose, and mouth)
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 0.8;
        const meshTriangles: [number, number, number, number][] = [
          // Forehead to nose bridge
          [fx, foreheadY + 12 * scale, leftEyeX, eyeY - 14 * scale],
          [fx, foreheadY + 12 * scale, rightEyeX, eyeY - 14 * scale],
          [leftEyeX, eyeY - 14 * scale, fx, eyeY - 10 * scale],
          [rightEyeX, eyeY - 14 * scale, fx, eyeY - 10 * scale],
          // Eyes to cheeks
          [leftEyeX - 12 * scale, eyeY, jawPoints[2][0], jawPoints[2][1]],
          [rightEyeX + 12 * scale, eyeY, jawPoints[10][0], jawPoints[10][1]],
          // Cheeks to nose tip
          [jawPoints[3][0], jawPoints[3][1], noseTipX - 8 * scale, noseTipY + 4 * scale],
          [jawPoints[9][0], jawPoints[9][1], noseTipX + 8 * scale, noseTipY + 4 * scale],
          // Nose to mouth corners
          [noseTipX, noseTipY + 4 * scale, fx - mouthW, mouthY],
          [noseTipX, noseTipY + 4 * scale, fx + mouthW, mouthY],
          // Mouth to chin
          [fx - mouthW, mouthY, jawPoints[6][0], jawPoints[6][1]],
          [fx + mouthW, mouthY, jawPoints[6][0], jawPoints[6][1]],
          // Cheek cross-links
          [leftEyeX, eyeY + 6 * scale, fx - mouthW * 0.7, mouthY - 4 * scale],
          [rightEyeX, eyeY + 6 * scale, fx + mouthW * 0.7, mouthY - 4 * scale]
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

        // Depth Contour Iso-curves
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
      // 3D Attitude Indicator (Top-Left HUD)
      const hudX = 28 * scale;
      const hudY = 32 * scale;
      const hudR = 14 * scale;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(hudX, hudY, hudR, 0, Math.PI * 2);
      ctx.stroke();

      // Artificial Horizon line (reflects headYaw / tilt)
      const yawAngle = (headYaw * Math.PI) / 180;
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(hudX - Math.cos(yawAngle) * hudR * 0.8, hudY - Math.sin(yawAngle) * hudR * 0.8);
      ctx.lineTo(hudX + Math.cos(yawAngle) * hudR * 0.8, hudY + Math.sin(yawAngle) * hudR * 0.8);
      ctx.stroke();

      // Attitude text
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = `bold ${Math.max(8, 8 * scale)}px monospace`;
      ctx.fillText(`YAW: ${headYaw > 0 ? '+' : ''}${headYaw}°`, hudX - 12 * scale, hudY + hudR + 10 * scale);

      // Distance & Lighting Telemetry (Bottom HUD)
      const botY = height - 12 * scale;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = `bold ${Math.max(8, 9 * scale)}px monospace`;
      ctx.fillText(`💡 TAA: ${lightingQuality}% LUX`, 10 * scale, botY);
      ctx.fillText(`📏 UMBALI: ${distanceCm}cm`, width - 95 * scale, botY);

      animFrameIdRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      isRunning = false;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [phase, isUnregistered, hudMode, faceConfidence, blinkCount, headYaw, lightingQuality, distanceCm]);

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={320}
      className={`absolute inset-0 w-full h-full pointer-events-none z-10 ${className}`}
    />
  );
};
