"use client";
import { useMemo } from "react";

export default function HostStudio() {
  const src = useMemo(() => process.env.NEXT_PUBLIC_STUDIO_URL || "https://localhost:8080/", []);
  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <iframe
        title="openDAW Studio"
        src={src}
        style={{ width: "100%", height: "100%", border: 0 }}
        allow="autoplay; clipboard-read; clipboard-write; microphone; camera; fullscreen"
      />
    </div>
  );
}

