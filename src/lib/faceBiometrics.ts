import * as faceapi from '@vladmandic/face-api';

const MODEL_BASE_URLS = [
  '/models/face',
  'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model'
];

let modelsLoaded = false;
let modelsLoadingPromise: Promise<void> | null = null;

export type FaceFailureReason = 'no_face' | 'multiple_faces' | 'low_quality' | 'model_error';

export interface FaceExtractionSuccess {
  ok: true;
  descriptor: number[];
  confidence: number;
  photoUrl: string;
  landmarks: Array<{ x: number; y: number }>;
  expressions: Record<string, number>;
  box: { x: number; y: number; width: number; height: number };
  reason?: FaceFailureReason;
  message?: string;
}

export interface FaceExtractionFailure {
  ok: false;
  reason: FaceFailureReason;
  message: string;
  descriptor?: number[];
  confidence?: number;
  photoUrl?: string;
}

export type FaceExtractionResult = FaceExtractionSuccess | FaceExtractionFailure;

export interface BiometricCandidate {
  id: string;
  name: string;
  phone: string;
  faceDescriptor?: number[];
  isRegistered?: boolean;
}

export interface FaceMatchResult<T extends BiometricCandidate> {
  matched: boolean;
  candidate?: T;
  distance: number;
  confidencePct: number;
  secondBestDistance?: number;
  reason: 'matched' | 'below_threshold' | 'ambiguous_match' | 'no_enrolled_vectors';
}

/**
 * Normalize Tanzanian phone numbers so 0754 892 100, +255754892100, 255754892100, and 754892100
 * always resolve to the same canonical lookup key (e.g., 0754892100).
 */
export function normalizeTzPhone(phone: string | undefined | null): string {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('255') && digits.length >= 12) {
    return `0${digits.slice(3, 12)}`;
  }
  if (digits.length === 9 && !digits.startsWith('0')) {
    return `0${digits}`;
  }
  if (digits.startsWith('0') && digits.length >= 10) {
    return digits.slice(0, 10);
  }
  return digits;
}

export function l2Normalize(vec: number[]): number[] {
  let normSq = 0;
  for (let i = 0; i < vec.length; i++) {
    normSq += vec[i] * vec[i];
  }
  const norm = Math.sqrt(normSq);
  if (norm < 1e-8) return vec.slice();
  return vec.map((v) => v / norm);
}

export function averageDescriptors(descriptors: number[][]): number[] {
  if (descriptors.length === 0) return [];
  const dim = descriptors[0].length;
  const sum = new Array<number>(dim).fill(0);
  for (const desc of descriptors) {
    for (let i = 0; i < dim; i++) {
      sum[i] += desc[i] || 0;
    }
  }
  const avg = sum.map((v) => v / descriptors.length);
  return l2Normalize(avg);
}

export function euclideanDistance(a: number[] | Float32Array, b: number[] | Float32Array): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 999;
  let sum = 0;
  for (let i = 0; i < len; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Calibrated confidence score from ResNet-34 face descriptor Euclidean distance.
 * Same-person distance typically sits around 0.22 - 0.43; different people are >= 0.60.
 */
export function distanceToConfidencePct(distance: number): number {
  if (!Number.isFinite(distance) || distance >= 1.2) return 0;
  if (distance <= 0.24) return 99.6;
  if (distance <= 0.50) {
    // Map [0.24 .. 0.50] smoothly to [99.5% .. 84.0%]
    const t = (distance - 0.24) / (0.50 - 0.24);
    return Number((99.5 - t * 15.5).toFixed(1));
  }
  // Map [0.50 .. 0.90] smoothly to [83.0% .. 10.0%]
  const t = Math.min(1, (distance - 0.50) / 0.40);
  return Number(Math.max(5, 83.0 - t * 73.0).toFixed(1));
}

export async function ensureFaceModelsLoaded(): Promise<void> {
  if (modelsLoaded) return;
  if (modelsLoadingPromise) return modelsLoadingPromise;

  modelsLoadingPromise = (async () => {
    let lastErr: any = null;
    for (const baseUrl of MODEL_BASE_URLS) {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(baseUrl),
          faceapi.nets.faceLandmark68Net.loadFromUri(baseUrl),
          faceapi.nets.faceRecognitionNet.loadFromUri(baseUrl),
          faceapi.nets.faceExpressionNet.loadFromUri(baseUrl)
        ]);
        modelsLoaded = true;
        return;
      } catch (err) {
        lastErr = err;
        console.warn(`[FaceBiometrics] Failed loading weights from ${baseUrl}:`, err);
      }
    }
    modelsLoadingPromise = null;
    throw new Error(`Imeshindwa kupakia modeli ya utambuzi wa uso: ${lastErr?.message || 'Unknown error'}`);
  })();

  return modelsLoadingPromise;
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith('data:') && !src.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

function snapshotSourceToCanvas(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  mirrored = false
): HTMLCanvasElement | null {
  const srcW =
    source instanceof HTMLVideoElement
      ? source.videoWidth
      : source instanceof HTMLImageElement
      ? source.naturalWidth || source.width
      : source.width;
  const srcH =
    source instanceof HTMLVideoElement
      ? source.videoHeight
      : source instanceof HTMLImageElement
      ? source.naturalHeight || source.height
      : source.height;

  if (!srcW || !srcH) return null;

  const maxSide = 640;
  const scale = Math.min(1, maxSide / Math.max(srcW, srcH));
  const targetW = Math.max(160, Math.round(srcW * scale));
  const targetH = Math.max(160, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.save();
  if (mirrored) {
    ctx.translate(targetW, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, 0, 0, targetW, targetH);
  ctx.restore();
  return canvas;
}

export function captureAlignedFaceDataUrl(
  canvas: HTMLCanvasElement,
  box: { x: number; y: number; width: number; height: number }
): string {
  const padX = box.width * 0.28;
  const padYTop = box.height * 0.32;
  const padYBottom = box.height * 0.22;

  const sx = Math.max(0, Math.floor(box.x - padX));
  const sy = Math.max(0, Math.floor(box.y - padYTop));
  const sw = Math.min(canvas.width - sx, Math.ceil(box.width + padX * 2));
  const sh = Math.min(canvas.height - sy, Math.ceil(box.height + padYTop + padYBottom));

  const out = document.createElement('canvas');
  out.width = 240;
  out.height = 240;
  const oCtx = out.getContext('2d');
  if (!oCtx || sw <= 10 || sh <= 10) {
    return canvas.toDataURL('image/jpeg', 0.82);
  }

  // Fit center square nicely into 240x240 avatar
  const side = Math.max(sw, sh);
  const cx = sx + sw / 2;
  const cy = sy + sh / 2;
  const cropX = Math.max(0, Math.min(canvas.width - side, cx - side / 2));
  const cropY = Math.max(0, Math.min(canvas.height - side, cy - side / 2));
  const cropSide = Math.min(side, canvas.width - cropX, canvas.height - cropY);

  oCtx.drawImage(canvas, cropX, cropY, cropSide, cropSide, 0, 0, 240, 240);
  return out.toDataURL('image/jpeg', 0.84);
}

/**
 * Extract 128-D neural face descriptor + landmarks + expression + aligned thumbnail
 * from a live video frame, canvas, image element, or image URL/dataUrl.
 */
export async function extractFaceBiometrics(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | string,
  options?: { mirrored?: boolean; requireSingleFace?: boolean }
): Promise<FaceExtractionResult> {
  try {
    await ensureFaceModelsLoaded();
  } catch (err: any) {
    return {
      ok: false,
      reason: 'model_error',
      message: err?.message || 'Modeli ya utambuzi wa uso haikupakia.'
    };
  }

  let el: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement;
  if (typeof source === 'string') {
    try {
      el = await loadImageElement(source);
    } catch {
      return {
        ok: false,
        reason: 'low_quality',
        message: 'Picha ya uso haikuweza kusomeka.'
      };
    }
  } else {
    el = source;
  }

  if (el instanceof HTMLVideoElement && (el.readyState < 2 || el.videoWidth === 0 || el.videoHeight === 0)) {
    return {
      ok: false,
      reason: 'no_face',
      message: 'Kamera bado haijakamilika kutoa picha. Subiri sekunde moja kisha ujaribu tena.'
    };
  }

  const workCanvas = snapshotSourceToCanvas(el, Boolean(options?.mirrored));
  if (!workCanvas) {
    return {
      ok: false,
      reason: 'no_face',
      message: 'Picha ya kamera haikupatikana.'
    };
  }

  try {
    let detections = await faceapi
      .detectAllFaces(workCanvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.44 }))
      .withFaceLandmarks()
      .withFaceExpressions()
      .withFaceDescriptors();

    if (!detections || detections.length === 0) {
      // Retry once with higher input resolution and slightly softer scoreThreshold for distant/uploaded images
      detections = await faceapi
        .detectAllFaces(workCanvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.34 }))
        .withFaceLandmarks()
        .withFaceExpressions()
        .withFaceDescriptors();
    }

    if (!detections || detections.length === 0) {
      return {
        ok: false,
        reason: 'no_face',
        message: 'Hakuna uso wa binadamu ulioonekana wazi. Weka uso katikati ya kamera kwenye mwanga mzuri.'
      };
    }

    if (options?.requireSingleFace && detections.length > 1) {
      return {
        ok: false,
        reason: 'multiple_faces',
        message: 'Nyuso zaidi ya moja zimeonekana. Tafadhali hakikisha ni mtu mmoja tu mbele ya kamera wakati wa usajili.'
      };
    }

    // Pick largest most prominent centered face
    const primary = detections.reduce((best, curr) => {
      const bestArea = best.detection.box.width * best.detection.box.height;
      const currArea = curr.detection.box.width * curr.detection.box.height;
      return currArea > bestArea ? curr : best;
    });

    const box = primary.detection.box;
    if (box.width < 36 || box.height < 36) {
      return {
        ok: false,
        reason: 'low_quality',
        message: 'Uso uko mbali sana na kamera. Sogea karibu kidogo (umbali wa 30-55cm).'
      };
    }

    const descriptor = l2Normalize(Array.from(primary.descriptor));
    const landmarks = primary.landmarks.positions.map((p) => ({
      x: Number((p.x / workCanvas.width).toFixed(4)),
      y: Number((p.y / workCanvas.height).toFixed(4))
    }));
    const photoUrl = captureAlignedFaceDataUrl(workCanvas, box);

    const exprObj: Record<string, number> = {};
    if (primary.expressions) {
      Object.entries(primary.expressions).forEach(([k, v]) => {
        exprObj[k] = Number(v);
      });
    }

    return {
      ok: true,
      descriptor,
      confidence: Number((primary.detection.score * 100).toFixed(1)),
      photoUrl,
      landmarks,
      expressions: exprObj,
      box: {
        x: Math.round(box.x),
        y: Math.round(box.y),
        width: Math.round(box.width),
        height: Math.round(box.height)
      }
    };
  } catch (err: any) {
    console.error('[FaceBiometrics] Extraction error:', err);
    return {
      ok: false,
      reason: 'model_error',
      message: 'Hitilafu ya uchakataji wa sura. Tafadhali jaribu tena.'
    };
  }
}

/**
 * Multi-frame enrollment: samples up to `samples` frames over ~250ms,
 * ensures consistent identity across frames, and averages descriptors for superior accuracy.
 */
export async function captureMultiFrameFaceEnrollment(
  video: HTMLVideoElement,
  samples = 3,
  mirrored = true
): Promise<FaceExtractionResult> {
  const descriptors: number[][] = [];
  let bestResult: FaceExtractionSuccess | null = null;
  let lastFailure: FaceExtractionFailure | null = null;

  for (let i = 0; i < samples; i++) {
    const res = await extractFaceBiometrics(video, { mirrored, requireSingleFace: true });
    if (res.ok) {
      if (descriptors.length === 0) {
        descriptors.push(res.descriptor);
        bestResult = res;
      } else {
        const distFromFirst = euclideanDistance(descriptors[0], res.descriptor);
        if (distFromFirst <= 0.45) {
          descriptors.push(res.descriptor);
          if (!bestResult || res.confidence > bestResult.confidence) {
            bestResult = res;
          }
        }
      }
    } else {
      const fail = res as FaceExtractionFailure;
      lastFailure = fail;
      if (fail.reason === 'multiple_faces' || fail.reason === 'model_error') {
        return fail;
      }
    }
    if (i < samples - 1) {
      await new Promise((r) => setTimeout(r, 95));
    }
  }

  if (!bestResult || descriptors.length === 0) {
    return (
      lastFailure || {
        ok: false,
        reason: 'no_face',
        message: 'Hakuna uso ulioonekana wazi mbele ya kamera. Tafadhali tazama kamera moja kwa moja.'
      }
    );
  }

  return {
    ...bestResult,
    descriptor: averageDescriptors(descriptors)
  };
}

/**
 * Capture simple JPEG snapshot directly from video (used as fallback preview only, NOT for identity bypass).
 */
export function captureRawVideoSnapshot(video: HTMLVideoElement | null, mirrored = true): string | null {
  if (!video || video.readyState < 2 || video.videoWidth === 0) return null;
  const canvas = snapshotSourceToCanvas(video, mirrored);
  if (!canvas) return null;
  return canvas.toDataURL('image/jpeg', 0.85);
}

/**
 * Strictly match a 128-D probe descriptor against ALL enrolled candidates (1:N identification).
 * Never falls back to random or first array item when probe doesn't match.
 */
export function matchFaceDescriptor<T extends BiometricCandidate>(
  probeDescriptor: number[],
  candidates: T[],
  maxDistance = 0.50
): FaceMatchResult<T> {
  const validCandidates = candidates.filter(
    (c) => c.isRegistered !== false && Array.isArray(c.faceDescriptor) && c.faceDescriptor.length === 128
  );

  if (validCandidates.length === 0) {
    return {
      matched: false,
      distance: 999,
      confidencePct: 0,
      reason: 'no_enrolled_vectors'
    };
  }

  const normProbe = l2Normalize(probeDescriptor);
  const scored = validCandidates
    .map((candidate) => ({
      candidate,
      distance: euclideanDistance(normProbe, candidate.faceDescriptor!)
    }))
    .sort((a, b) => a.distance - b.distance);

  const best = scored[0];
  const second = scored[1];
  const conf = distanceToConfidencePct(best.distance);

  if (best.distance > maxDistance) {
    return {
      matched: false,
      candidate: best.candidate,
      distance: best.distance,
      confidencePct: conf,
      secondBestDistance: second?.distance,
      reason: 'below_threshold'
    };
  }

  // Guard against near-tie ambiguous matches right at the boundary
  if (second && best.distance > 0.42 && second.distance - best.distance < 0.03) {
    return {
      matched: false,
      candidate: best.candidate,
      distance: best.distance,
      confidencePct: conf,
      secondBestDistance: second.distance,
      reason: 'ambiguous_match'
    };
  }

  return {
    matched: true,
    candidate: best.candidate,
    distance: best.distance,
    confidencePct: conf,
    secondBestDistance: second?.distance,
    reason: 'matched'
  };
}
