"use client";

import { useEffect, useRef, useState } from "react";

interface JanScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export default function JanScanner({ onScan, onClose }: JanScannerProps) {
  const scannerRef = useRef<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let html5QrCode: unknown = null;

    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        html5QrCode = new Html5Qrcode("qr-reader");
        scannerRef.current = html5QrCode;

        await (html5QrCode as InstanceType<typeof Html5Qrcode>).start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 150 },
            aspectRatio: 1.0,
          },
          (decodedText: string) => {
            onScan(decodedText);
          },
          () => {
            // Scan failure - silent
          }
        );

        setIsLoading(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Không thể mở camera";
        if (message.includes("Permission")) {
          setError("Vui lòng cấp quyền truy cập Camera trong phần Cài đặt.");
        } else {
          setError(`Lỗi camera: ${message}`);
        }
        setIsLoading(false);
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current) {
        const scanner = scannerRef.current as { stop: () => Promise<void>; clear: () => void };
        scanner.stop().then(() => scanner.clear()).catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white text-lg font-semibold">Quét mã vạch JAN</h2>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Đóng camera"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="relative bg-slate-900 rounded-xl overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-10">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-white/60 text-sm">Đang khởi động camera...</p>
              </div>
            </div>
          )}

          {error ? (
            <div className="p-8 text-center">
              <div className="text-4xl mb-3">📷</div>
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          ) : (
            <div id="qr-reader" className="w-full" />
          )}
        </div>

        <div className="mt-4 flex items-center gap-2 text-white/50 text-xs justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Hướng camera vào mã vạch JAN trên sản phẩm</span>
        </div>
      </div>
    </div>
  );
}
