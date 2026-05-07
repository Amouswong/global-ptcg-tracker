"use client";

import { useCallback, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onCapture: (file: File) => void;
}

export function CameraCapture({ onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setActive(true);
    } catch {
      setError("Camera access denied. Please allow camera permissions.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
  }, []);

  const capture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
          onCapture(file);
          stopCamera();
        }
      },
      "image/jpeg",
      0.92
    );
  }, [onCapture, stopCamera]);

  if (!active) {
    return (
      <div className="sm:hidden">
        <Button variant="outline" className="w-full gap-2" onClick={startCamera}>
          <Camera className="h-4 w-4" />
          Take a Photo
        </Button>
        {error && <p className="text-xs text-destructive mt-2">{error}</p>}
      </div>
    );
  }

  return (
    <div className="sm:hidden space-y-2">
      <div className="relative rounded-xl overflow-hidden bg-black aspect-[3/4]">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="border-2 border-white/60 rounded-lg w-3/4 h-1/2" />
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <div className="flex gap-2">
        <Button onClick={capture} className="flex-1">Capture</Button>
        <Button variant="outline" size="icon" onClick={stopCamera}><X className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}
