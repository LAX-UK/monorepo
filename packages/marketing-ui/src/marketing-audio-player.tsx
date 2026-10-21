"use client";

import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Slider } from "@auction/ui/components/slider";
import { useEffect, useRef, useState } from "react";
import { MarketingPauseIcon, MarketingPlayIcon } from "./marketing-icons.js";

export type MarketingAudioPlayerProps = {
  /** https URL of the audio file. */
  src: string;
  /** Names the controls, e.g. the episode title. */
  title: string;
  /** Used for the total time until the file reports its own length. */
  durationSeconds?: number | null;
  className?: string;
};

/** "3:07" or "1:02:03". */
export function formatAudioTime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/**
 * Podcast player on a native `<audio>` with custom controls: the browser's own bar cannot be
 * themed, but the element keeps buffering and media-session behaviour. The seek slider is
 * keyboard operable (arrow keys, Home/End) through Radix.
 */
export function MarketingAudioPlayer({
  src,
  title,
  durationSeconds,
  className,
}: MarketingAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [length, setLength] = useState(durationSeconds ?? 0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLength(durationSeconds ?? 0);
  }, [durationSeconds]);

  async function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    try {
      await audio.play();
    } catch {
      setPlaying(false);
    }
  }

  function seek(next: number) {
    const audio = audioRef.current;
    if (audio) audio.currentTime = next;
    setPosition(next);
  }

  const max = Math.max(1, Math.floor(length));

  return (
    <div className={cn("flex w-full flex-col gap-2", className)} data-testid="marketing-audio">
      {/* biome-ignore lint/a11y/useMediaCaption: episodes are audio-only; the page carries the notes. */}
      <audio
        ref={audioRef}
        src={src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => setFailed(true)}
        onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => {
          const reported = event.currentTarget.duration;
          if (Number.isFinite(reported) && reported > 0) setLength(reported);
        }}
      />
      <div className="flex items-center gap-4">
        <Button
          type="button"
          size="icon"
          disabled={failed}
          onClick={toggle}
          aria-label={`${playing ? "Pause" : "Play"} ${title}`}
          className={cn("size-12 shrink-0 rounded-full", FOCUS_RING)}
        >
          {playing ? <MarketingPauseIcon /> : <MarketingPlayIcon className="ml-0.5" />}
        </Button>
        <Slider
          thumbLabel={`Seek ${title}`}
          min={0}
          max={max}
          step={1}
          value={[Math.min(Math.floor(position), max)]}
          disabled={failed || length <= 0}
          onValueChange={([next]) => seek(next ?? 0)}
          className="min-h-11"
        />
        <p className="shrink-0 font-label text-sm tabular-nums">
          <span>{formatAudioTime(position)}</span>
          <span aria-hidden> / </span>
          <span className="sr-only"> of </span>
          <span>{formatAudioTime(length)}</span>
        </p>
      </div>
      {failed ? <output className="text-sm">This episode could not be loaded.</output> : null}
    </div>
  );
}
