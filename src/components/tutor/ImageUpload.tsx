'use client';

import { useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase/client';

interface Props {
  studentUid: string;
  onImageReady: (params: { imageUrl: string; imageBase64: string; mimeType: string }) => void;
}

// Converts a File to base64 for the Gemini Vision call, and separately
// uploads the same file to Storage so a permanent URL exists for chat history.
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ImageUpload({ studentUid, onImageReady }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    setPreview(URL.createObjectURL(file));
    try {
      const base64 = await fileToBase64(file);
      const storageRef = ref(storage, `doubts/${studentUid}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const imageUrl = await getDownloadURL(storageRef);
      onImageReady({ imageUrl, imageBase64: base64, mimeType: file.type });
    } finally {
      setUploading(false);
    }
  }

  if (preview) {
    return (
      <div className="relative inline-block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt="Uploaded doubt" className="h-16 w-16 rounded-lg object-cover" />
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          </div>
        )}
        <button
          type="button"
          onClick={() => setPreview(null)}
          className="absolute -right-2 -top-2 rounded-full bg-ink p-0.5 text-white"
          aria-label="Remove image"
        >
          <X size={12} />
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-ink/15 text-ink/60 hover:border-indigo hover:text-indigo"
        aria-label="Upload a photo of your doubt"
      >
        <Camera size={18} />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </>
  );
}
