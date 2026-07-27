import QRious from 'qrious';
import { MARKER_QUERY_PARAMETER } from './MarkerUrlCodec';

/** Edge length of the generated code in pixels. */
const QR_SIZE = 250;

/**
 * QR code that carries the current marker set as a link.
 *
 * The code is created on demand and removed again on the next click, so it does
 * not take up space in the menu permanently. Clicking the code copies the link
 * to the clipboard.
 */
export class QrCodeExport {
    #canvas: HTMLCanvasElement | null = null;

    /**
     * @param container Element the code is appended to.
     * @param getMarkerData Encoded marker set for the link.
     */
    constructor(
        private readonly container: HTMLElement,
        private readonly getMarkerData: () => string
    ) { }

    /** Shows the code, or hides it again if it is already visible. */
    toggle(): void {
        if (this.#canvas) {
            this.hide();
            return;
        }
        this.show();
    }

    /** Removes the code from the menu. */
    hide(): void {
        this.#canvas?.remove();
        this.#canvas = null;
    }

    private show(): void {
        const url = `${location.protocol}//${location.host}${location.pathname}`;
        const value = `${url}?${MARKER_QUERY_PARAMETER}=${this.getMarkerData()}`;

        const canvas = document.createElement('canvas');
        canvas.id = 'qrCanvas';
        canvas.title = 'Klicken, um den Link zu kopieren';
        canvas.addEventListener('click', () => void this.copyToClipboard(value));

        new QRious({ element: canvas, size: QR_SIZE, value });
        this.container.appendChild(canvas);
        this.#canvas = canvas;
    }

    private async copyToClipboard(value: string): Promise<void> {
        try {
            await navigator.clipboard.writeText(value);
            alert('Link kopiert.');
        } catch (error) {
            alert(`Kopieren fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
