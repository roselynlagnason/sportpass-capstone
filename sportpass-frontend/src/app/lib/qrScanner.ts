import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

export type CameraScanner = { clear: () => Promise<void> };

// Turns a camera error into a message a student or officer can act on.
export function cameraErrorMessage(err: unknown): string {
  const e = err as { name?: string; message?: string } | undefined;
  const text = `${e?.name || ""} ${e?.message || ""} ${String(err || "")}`;

  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "The camera only works on a secure https:// link.";
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return "This browser can't open the camera. Open the link in Chrome or Safari, not inside Messenger or Facebook.";
  }
  if (/NotAllowed|Permission|denied/i.test(text)) {
    return "Camera access is blocked. Allow the camera for this site in your browser settings, then tap Try again.";
  }
  if (/NotFound|Overconstrained|not found|no camera/i.test(text)) {
    return "No camera was found on this device.";
  }
  if (/NotReadable|TrackStart|Could not start/i.test(text)) {
    return "The camera is being used by another app. Close it and tap Try again.";
  }
  return "Couldn't open the camera. Use Chrome or Safari, allow camera access, then tap Try again.";
}

// Opens the back camera (or any camera on a laptop) inside the element with
// this id and calls onDecoded for each QR code read. The scan box scales to
// the screen, so it also works on narrow phones.
export async function startCameraScanner(
  elementId: string,
  onDecoded: (text: string) => void
): Promise<CameraScanner> {
  const reader = new Html5Qrcode(elementId, {
    formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
    verbose: false,
  });

  let stopped = false;
  const clear = async () => {
    if (stopped) return;
    stopped = true;
    try {
      if (reader.isScanning) await reader.stop();
    } catch {
      /* already stopped */
    }
    try {
      reader.clear();
    } catch {
      /* nothing to clear */
    }
  };

  const config = {
    fps: 10,
    aspectRatio: 1,
    qrbox: (width: number, height: number) => {
      const size = Math.max(100, Math.floor(Math.min(width, height) * 0.7));
      return { width: Math.min(size, width), height: Math.min(size, height) };
    },
  };

  const onSuccess = (text: string) => {
    if (!stopped) onDecoded(text);
  };

  try {
    await reader.start({ facingMode: "environment" }, config, onSuccess, () => {});
  } catch (firstError) {
    // Some laptops reject facingMode; fall back to the first camera found.
    try {
      const cameras = await Html5Qrcode.getCameras();
      if (!cameras.length) throw firstError;
      await reader.start(cameras[0].id, config, onSuccess, () => {});
    } catch {
      stopped = true;
      try {
        reader.clear();
      } catch {
        /* ignore */
      }
      throw firstError;
    }
  }

  return { clear };
}
