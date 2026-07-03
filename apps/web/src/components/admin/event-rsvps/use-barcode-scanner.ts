"use client";

type BarcodeDetectorLike = {
  detect(source: ImageBitmapSource): Promise<Array<{ rawValue?: string }>>;
};

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike;
  }
}

import { type RefObject, useEffect, useRef, useState } from "react";

type UseBarcodeScannerInput = {
  active: boolean;
  busyRef: RefObject<boolean>;
  onScan: (token: string) => void;
};

export function useBarcodeScanner({ active, busyRef, onScan }: UseBarcodeScannerInput) {
  const [cameraSupported, setCameraSupported] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const zxingControlsRef = useRef<{ stop: () => void } | null>(null);
  const onScanRef = useRef(onScan);

  onScanRef.current = onScan;

  useEffect(() => {
    function stopScanner() {
      if (scanTimerRef.current != null) window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
      zxingControlsRef.current?.stop();
      zxingControlsRef.current = null;
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) track.stop();
        streamRef.current = null;
      }
    }

    if (!active) {
      stopScanner();
      return;
    }

    let cancelled = false;
    async function startScanner() {
      const video = videoRef.current;
      if (!video) return;

      if ("BarcodeDetector" in window) {
        setCameraSupported(true);
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false,
          });
          if (cancelled) {
            for (const track of stream.getTracks()) track.stop();
            return;
          }
          streamRef.current = stream;
          video.srcObject = stream;
          await video.play();
          const Detector = window.BarcodeDetector;
          if (!Detector) return;
          const detector = new Detector({ formats: ["qr_code"] });
          scanTimerRef.current = window.setInterval(() => {
            const el = videoRef.current;
            if (!el || el.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || busyRef.current)
              return;
            void detector
              .detect(el)
              .then((codes) => {
                const raw = codes[0]?.rawValue?.trim();
                if (raw) onScanRef.current(raw);
              })
              .catch(() => undefined);
          }, 500);
        } catch {
          setCameraSupported(false);
        }
        return;
      }

      setCameraSupported(true);
      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        const reader = new BrowserQRCodeReader();
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: "environment" } },
          video,
          (result) => {
            if (!result || busyRef.current) return;
            onScanRef.current(result.getText());
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        zxingControlsRef.current = controls;
      } catch {
        setCameraSupported(false);
      }
    }
    void startScanner();
    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [active, busyRef]);

  return { cameraSupported, videoRef };
}
