import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useBackground } from "@/components/background/background-provider"
import {
  BackgroundAdaptToggle,
  BackgroundEnableToggle,
  BackgroundSliders,
} from "./background-controls"
import { BackgroundPreview, BackgroundUploadButton } from "./background-preview"
import { FormError } from "./form-error"
import { errMessage } from "./select-value"

function BackgroundMedia({
  hasImage,
  imageUrl,
  mediaKind,
  uploading,
  uploadLabel,
  onPick,
  onRemove,
}: {
  hasImage: boolean
  imageUrl: string | null
  mediaKind: ReturnType<typeof useBackground>["mediaKind"]
  uploading: boolean
  uploadLabel: string
  onPick: () => void
  onRemove: () => void
}) {
  if (hasImage && imageUrl) {
    return (
      <BackgroundPreview
        imageUrl={imageUrl}
        mediaKind={mediaKind}
        uploading={uploading}
        onPick={onPick}
        onRemove={onRemove}
      />
    )
  }
  return (
    <BackgroundUploadButton
      uploading={uploading}
      label={uploadLabel}
      onPick={onPick}
    />
  )
}

function BackgroundAdjustBlock({
  settings,
  update,
}: {
  settings: ReturnType<typeof useBackground>["settings"]
  update: ReturnType<typeof useBackground>["update"]
}) {
  if (!settings.hasImage) return null
  return (
    <>
      <BackgroundEnableToggle enabled={settings.enabled} onUpdate={update} />
      {settings.enabled && (
        <BackgroundSliders
          opacity={settings.opacity}
          blur={settings.blur}
          onUpdate={update}
        />
      )}
      <BackgroundAdaptToggle autoAdapt={settings.autoAdapt} onUpdate={update} />
    </>
  )
}

/** Background image/video settings: upload, opacity, blur, enable, auto-adapt. */
export function BackgroundPanel() {
  const { t } = useTranslation()
  const { settings, imageUrl, mediaKind, uploading, upload, remove, update } =
    useBackground()
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const handlePick = () => fileRef.current?.click()
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setError(null)
    try {
      await upload(file)
    } catch (err) {
      setError(errMessage(err))
    }
  }
  return (
    <div className="space-y-4">
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/mp4,video/webm"
        className="hidden"
        onChange={handleFile}
      />
      <BackgroundMedia
        hasImage={settings.hasImage}
        imageUrl={imageUrl}
        mediaKind={mediaKind}
        uploading={uploading}
        uploadLabel={t("settings.backgroundUpload")}
        onPick={handlePick}
        onRemove={() => void remove()}
      />
      <FormError error={error} />
      <BackgroundAdjustBlock settings={settings} update={update} />
    </div>
  )
}
