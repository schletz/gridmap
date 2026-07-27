/**
 * Minimal ambient declaration for the QRious library, which ships without types.
 * Only the options actually used by this application are declared.
 */
declare module 'qrious' {
    export interface QRiousOptions {
        /** Canvas or image element the code is rendered into. */
        element?: HTMLCanvasElement | HTMLImageElement;
        /** Background colour of the code. */
        background?: string;
        /** Foreground colour of the code. */
        foreground?: string;
        /** Error correction level. */
        level?: 'L' | 'M' | 'Q' | 'H';
        /** Edge length of the rendered code in pixels. */
        size?: number;
        /** Payload of the code. */
        value?: string;
    }

    export default class QRious {
        constructor(options?: QRiousOptions);
        toDataURL(mimeType?: string): string;
        value: string;
    }
}
