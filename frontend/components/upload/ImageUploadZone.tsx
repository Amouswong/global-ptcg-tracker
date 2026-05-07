"use client";

import { useCallback, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  /** Called with each valid file. Use `multiple` to allow batches. */
  onFile: (file: File) => void;
  multiple?: boolean;
  disabled?: boolean;
}

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

export function ImageUploadZone({ onFile, multiple = false, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      if (!ACCEPTED.includes(file.type)) {
        alert("Only JPEG, PNG, or WebP images are accepted.");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert("Image must be under 10MB.");
        return;
      }
      onFile(file);
    },
    [onFile]
  );

  const handleFileList = useCallback(
    (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (multiple) {
        files.forEach(handleFile);
      } else {
        if (files[0]) handleFile(files[0]);
      }
    },
    [multiple, handleFile]
  );

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);

      // Local file drop (may be multiple)
      if (e.dataTransfer.files.length > 0) {
        handleFileList(e.dataTransfer.files);
        return;
      }

      // Browser image drag — comes as a URL, not a File
      const url =
        e.dataTransfer.getData("text/uri-list") ||
        e.dataTransfer.getData("text/plain");
      if (!url) return;

      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const name = url.split("/").pop()?.split("?")[0] ?? "image";
        handleFile(new File([blob], name, { type: blob.type }));
      } catch {
        alert("Could not load the image from that URL.");
      }
    },
    [handleFile, handleFileList]
  );

  return (
    <div
      onDrop={onDrop}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onClick={() => inputRef.current?.click()}
      className={`
        border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3
        cursor-pointer transition-colors select-none
        ${dragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50"}
        ${disabled ? "opacity-50 pointer-events-none" : ""}
      `}
    >
      <Upload className="h-8 w-8 text-muted-foreground" />
      <div className="text-center">
        <p className="text-sm font-medium">
          {multiple ? "Drop card images here" : "Drop a card image here"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {multiple ? "or click to browse · multiple files supported · " : "or click to browse · "}
          JPEG, PNG, WebP · max 10MB
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        multiple={multiple}
        className="hidden"
        onChange={(e) => { if (e.target.files) handleFileList(e.target.files); }}
      />
    </div>
  );
}
