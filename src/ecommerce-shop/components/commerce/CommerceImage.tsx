import { Image } from "@openai/apps-sdk-ui/components/Image";
import clsx from "clsx";
import { ImageOff } from "lucide-react";
import { useState } from "react";

export function CommerceImage({
  src,
  alt,
  className,
  imageClassName,
  fallbackLabel = "Imagem indisponível",
}: {
  src?: string;
  alt: string;
  className?: string;
  imageClassName?: string;
  fallbackLabel?: string;
}) {
  const [hasError, setHasError] = useState(!src);

  return (
    <div
      className={clsx(
        "relative overflow-hidden bg-[linear-gradient(135deg,#f2e6d8_0%,#fbf5ee_45%,#ead8c5_100%)]",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(184,79,59,0.18),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(0,0,0,0.06),transparent_42%)]" />
      {!hasError && src ? (
        <Image
          src={src}
          alt={alt}
          onError={() => setHasError(true)}
          className={clsx("relative z-10 h-full w-full object-cover", imageClassName)}
        />
      ) : null}
      {hasError ? (
        <div className="absolute inset-0 z-20 flex h-full w-full flex-col justify-between p-3 text-black/70">
          <span className="inline-flex w-fit rounded-full bg-white/76 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] backdrop-blur-sm">
            FARM Rio
          </span>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/76 px-2.5 py-1.5 text-[11px] font-medium backdrop-blur-sm">
            <ImageOff className="h-3.5 w-3.5" aria-hidden="true" />
            {fallbackLabel}
          </span>
        </div>
      ) : null}
    </div>
  );
}