'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import QrScannerLib from 'qr-scanner';
import { ImageIcon, Camera } from 'lucide-react';

export interface QrScannerProps {
  onScan: (raw: string) => void;
}

type Mode = 'live' | 'image' | 'manual';
type LiveState = 'idle' | 'requesting' | 'scanning' | 'error';

function ModeTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${active ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50' : 'text-zinc-500 cursor-pointer hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'}`}>
      {children}
    </button>
  );
}

function LiveCameraPanel({ onScan }: { onScan: (raw: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScannerLib | null>(null);
  const didScanRef = useRef(false);

  const [liveState, setLiveState] = useState<LiveState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const destroyScanner = useCallback(() => {
    if (scannerRef.current) {
      scannerRef.current.destroy();
      scannerRef.current = null;
    }
  }, []);

  const stopScanning = useCallback(() => {
    destroyScanner();
    setLiveState('idle');
  }, [destroyScanner]);

  const startScanner = useCallback(async () => {
    if (!videoRef.current) return;

    didScanRef.current = false;
    setErrorMessage(null);
    setLiveState('requesting');
    destroyScanner();

    const scanner = new QrScannerLib(
      videoRef.current,
      (result) => {
        if (didScanRef.current) return;

        didScanRef.current = true;
        stopScanning();
        onScanRef.current(result.data);
      },
      {
        onDecodeError: () => {},
        preferredCamera: 'environment',
        highlightScanRegion: false,
        highlightCodeOutline: false,
        returnDetailedScanResult: true,
        maxScansPerSecond: 15
      }
    );

    scannerRef.current = scanner;

    try {
      await scanner.start();
      setLiveState('scanning');
    } catch (err) {
      destroyScanner();
      const msg =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access and try again.'
          : err instanceof DOMException && err.name === 'NotFoundError'
            ? 'No camera found on this device.'
            : 'Could not start camera. Please try again.';
      setErrorMessage(msg);
      setLiveState('error');
    }
  }, [destroyScanner, stopScanning]);

  useEffect(() => () => destroyScanner(), [destroyScanner]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-full overflow-hidden rounded-2xl bg-zinc-900">
        <video ref={videoRef} className={`h-64 w-full object-cover transition-opacity ${liveState === 'scanning' ? 'opacity-100' : 'opacity-0'}`} playsInline muted aria-label="Camera preview" />

        {liveState !== 'scanning' && (
          <div className="absolute inset-0 flex h-64 items-center justify-center">
            <span className="text-sm text-zinc-500">{liveState === 'requesting' ? 'Starting camera…' : 'Camera preview'}</span>
          </div>
        )}

        {liveState === 'scanning' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-40 w-40 rounded-xl border-2 border-white/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
        )}
      </div>

      {errorMessage && (
        <p role="alert" className="text-center text-sm text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      )}

      {liveState === 'scanning' && <p className="text-center text-xs text-zinc-500">Hold the cup sticker straight-on, flat and well-lit.</p>}

      {liveState !== 'scanning' ? (
        <button
          type="button"
          onClick={startScanner}
          disabled={liveState === 'requesting'}
          className={`rounded-xl ${liveState === 'requesting' ? 'cursor-not-allowed' : 'cursor-pointer'} bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200`}>
          {liveState === 'requesting' ? 'Starting…' : liveState === 'error' ? 'Try again' : 'Start scanning'}
        </button>
      ) : (
        <button type="button" onClick={stopScanning} className="text-sm text-zinc-500 underline underline-offset-2 hover:no-underline">
          Cancel
        </button>
      )}
    </div>
  );
}

function ImageScanPanel({ onScan }: { onScan: (raw: string) => void }) {
  const [status, setStatus] = useState<'idle' | 'decoding' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  // Clean up object URL on unmount
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl]
  );

  const decodeFile = useCallback(
    async (file: File) => {
      setStatus('decoding');
      setErrorMessage(null);

      // Show a preview
      if (previewUrl) URL.revokeObjectURL(previewUrl);

      setPreviewUrl(URL.createObjectURL(file));

      try {
        const result = await QrScannerLib.scanImage(file, {
          returnDetailedScanResult: true,
          alsoTryWithoutScanRegion: true
        });
        onScanRef.current(result.data);
      } catch {
        setStatus('error');
        setErrorMessage('No QR code found in this image. Make sure the QR code is visible and try again, or use the manual input tab.');
      }
    },
    [previewUrl]
  );

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) decodeFile(file);

    e.target.value = '';
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">Upload an image containing the QR code, or use your native camera app to take a photo - the device will decode it from the still image.</p>
      <div className="grid grid-cols-2 gap-3">
        {/* Gallery / file picker */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={status === 'decoding'}
          className={`flex flex-col items-center gap-1.5 rounded-xl ${status === 'decoding' ? 'cursor-not-allowed' : 'cursor-pointer'} border border-zinc-300 bg-white px-4 py-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800`}>
          <span className="text-zinc-600 dark:text-zinc-400" aria-hidden>
            <ImageIcon className="h-6 w-6" />
          </span>
          Upload image
        </button>

        {/* Native camera app */}
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={status === 'decoding'}
          className={`flex flex-col items-center gap-1.5 rounded-xl ${status === 'decoding' ? 'cursor-not-allowed' : 'cursor-pointer'} border border-zinc-300 bg-white px-4 py-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800`}>
          <span className="text-zinc-600 dark:text-zinc-400" aria-hidden>
            <Camera className="h-6 w-6" />
          </span>
          Take photo
        </button>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" aria-hidden onChange={handleFileChange} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" aria-hidden onChange={handleFileChange} />
      {status === 'decoding' && <p className="text-center text-sm text-zinc-500">Decoding…</p>}

      {previewUrl && status !== 'decoding' && <img src={previewUrl} alt="Selected image" className="max-h-48 w-full rounded-xl object-contain" />}

      {errorMessage && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

function ManualInputPanel({ onScan }: { onScan: (raw: string) => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      setError('Please paste or type the QR code payload.');
      return;
    }

    setError(null);
    onScanRef.current(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Scan the QR code with your camera app, copy the decoded text, and paste it here. The payload looks something like <code className="rounded bg-zinc-100 px-1 font-mono text-xs dark:bg-zinc-800">T0241|SG0422|A002,C003,m003,mm002|</code>
      </p>

      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
        }}
        placeholder="T0241|SG0422|A002,C003,m003,mm002|"
        rows={3}
        className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 font-mono text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-600 dark:focus:border-zinc-400"
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
      />

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <button type="submit" className="self-start rounded-xl cursor-pointer bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200">
        Use this payload
      </button>
    </form>
  );
}

export default function QrScanner({ onScan }: QrScannerProps) {
  const [mode, setMode] = useState<Mode>('live');

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
        <ModeTab active={mode === 'live'} onClick={() => setMode('live')}>
          Live camera
        </ModeTab>
        <ModeTab active={mode === 'image'} onClick={() => setMode('image')}>
          Image / photo
        </ModeTab>
        <ModeTab active={mode === 'manual'} onClick={() => setMode('manual')}>
          Manual input
        </ModeTab>
      </div>

      {mode === 'live' && <LiveCameraPanel onScan={onScan} />}
      {mode === 'image' && <ImageScanPanel onScan={onScan} />}
      {mode === 'manual' && <ManualInputPanel onScan={onScan} />}
    </div>
  );
}
