import { convertFileSrc } from '@tauri-apps/api/core';
import { getFileExtension } from './functions';

// 1x1 lossless JPEG XL, used to check whether the webview can display JPEG XL itself
const JXL_PROBE = 'data:image/jxl;base64,/woAEAwExY0IAAEAHABLGIsVwhAO';

// lets the Rust fallback be tested on webviews with native support, e.g.
// VITE_FORCE_IMAGE_DECODING=true npm run tauri build
const forceDecoding = import.meta.env.VITE_FORCE_IMAGE_DECODING === 'true';

let nativeJxlSupport = false;

// must resolve before the first image is rendered, see main.tsx
export function detectImageSupport(): Promise<void> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            nativeJxlSupport = !forceDecoding;
            resolve();
        };
        img.onerror = () => resolve();
        img.src = JXL_PROBE;
    });
}

// Formats the webview can't display are decoded by the backend (see image_decoding.rs).
// `maxSize` bounds the decoded image for small previews and only applies to decoded images.
export function imageSrc(path: string, maxSize?: number): string {
    if (nativeJxlSupport || getFileExtension(path)?.toLowerCase() !== 'jxl') {
        return convertFileSrc(path);
    }
    const src = convertFileSrc(path, 'decoded');
    return maxSize === undefined ? src : `${src}?max=${maxSize}`;
}
