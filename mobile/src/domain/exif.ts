// 사진 촬영 정보(EXIF) 요약과 위치 정보 확인.
// expo-image-picker는 iOS·Android 모두 EXIF를 평평한 객체로 준다.
// iOS는 GPS 사전을 "GPS<태그>" 키로, TIFF의 Make·Model을 같은 객체에 합쳐 준다.
import type { ExifSummary } from './types';

type RawExif = Record<string, unknown> | null | undefined;

function toNumber(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (Array.isArray(v)) return toNumber(v[0]);
  if (typeof v === 'string') {
    const s = v.trim();
    const frac = /^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(s);
    if (frac) {
      const den = Number(frac[2]);
      return den === 0 ? undefined : Number(frac[1]) / den;
    }
    const n = Number(s);
    return s !== '' && Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function toText(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.replace(/\0/g, '').trim();
  return s || undefined;
}

function trimNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

export function formatShutter(seconds: number): string {
  if (seconds <= 0) return '';
  if (seconds >= 1) return `${trimNumber(seconds)}s`;
  return `1/${Math.round(1 / seconds)}`;
}

/** 카메라 모델 이름에 제조사가 이미 들어 있으면 한 번만 쓴다. 예: "Apple" + "iPhone 15 Pro" */
function cameraName(make?: string, model?: string): string | undefined {
  if (!model) return make;
  if (!make) return model;
  const brand = make.split(' ')[0].toLowerCase();
  if (model.toLowerCase().startsWith(brand) || make.toLowerCase() === 'apple') return model;
  return `${make} ${model}`;
}

export function summarizeExif(raw: RawExif): ExifSummary {
  if (!raw) return {};
  const summary: ExifSummary = {};

  const camera = cameraName(toText(raw.Make), toText(raw.Model));
  if (camera) summary.camera = camera;

  const lens = toText(raw.LensModel);
  if (lens) summary.lens = lens;

  const focal = toNumber(raw.FocalLength);
  if (focal && focal > 0) summary.focalLength = `${trimNumber(focal)}mm`;

  const fNumber = toNumber(raw.FNumber);
  if (fNumber && fNumber > 0) summary.aperture = `f/${trimNumber(fNumber)}`;

  const exposure = toNumber(raw.ExposureTime);
  if (exposure && exposure > 0) summary.shutter = formatShutter(exposure);

  const iso = toNumber(raw.ISOSpeedRatings ?? raw.PhotographicSensitivity);
  if (iso && iso > 0) summary.iso = `ISO ${Math.round(iso)}`;

  return summary;
}

/** 원본 사진에 위치 정보가 들어 있었는가. 업로드 화면에서 "위치 정보를 지웠어요" 안내에 쓴다 */
export function hasGpsData(raw: RawExif): boolean {
  if (!raw) return false;
  return Object.entries(raw).some(
    ([key, value]) => (key.startsWith('GPS') || key === '{GPS}') && value !== null && value !== undefined && value !== '',
  );
}

export function formatExifLine(s: ExifSummary): string {
  return [s.camera, s.focalLength, s.aperture, s.shutter, s.iso].filter(Boolean).join(' · ');
}

export function isEmptyExif(s: ExifSummary): boolean {
  return Object.values(s).every((v) => !v);
}

/** 업로드용 크기. 긴 변을 2048px로 줄인다 (docs/05-competitor-analysis.md 5절 제안 5) */
export const UPLOAD_LONG_EDGE = 2048;

export function uploadResize(width: number, height: number): { width: number } | { height: number } | null {
  if (Math.max(width, height) <= UPLOAD_LONG_EDGE) return null;
  return width >= height ? { width: UPLOAD_LONG_EDGE } : { height: UPLOAD_LONG_EDGE };
}
