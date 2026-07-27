import { TypedEventEmitter } from '../core/TypedEventEmitter';

interface DeviceOrientationEvents extends Record<string, unknown[]> {
    /** New heading of the device in degrees, clockwise from north. */
    headingchanged: [heading: number];
}

/** Safari reports the compass heading in a vendor property. */
interface CompassOrientationEvent extends DeviceOrientationEvent {
    readonly webkitCompassHeading?: number;
}

/**
 * Heading of the device, used to rotate the arrow of the gps marker.
 *
 * Browsers disagree on the event name and on the reference frame: only
 * `deviceorientationabsolute` (and Safari's `webkitCompassHeading`) is relative
 * to true north, everything else is relative to the orientation the page was
 * opened with.
 */
export class DeviceOrientationTracker extends TypedEventEmitter<DeviceOrientationEvents> {
    constructor() {
        super();
        const eventName = 'ondeviceorientationabsolute' in window
            ? 'deviceorientationabsolute'
            : ('ondeviceorientation' in window ? 'deviceorientation' : null);
        if (!eventName) return;

        window.addEventListener(eventName, (event) => this.handle(event as CompassOrientationEvent));
    }

    private handle(event: CompassOrientationEvent): void {
        const compassHeading = event.webkitCompassHeading;
        let angle = compassHeading ?? event.alpha;
        if (angle === null || angle === undefined) return;

        // Safari on iOS counts the heading the other way round when it is relative.
        if (!event.absolute && compassHeading !== undefined) angle = 360 - angle;

        // Older browsers report the angle relative to the initial screen orientation.
        const screenAngle = window.screen.orientation?.angle ?? 0;
        this.emit('headingchanged', 360 - (angle - (event.absolute ? 0 : screenAngle)));
    }
}
