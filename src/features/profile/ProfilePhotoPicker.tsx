import { useRef, useState, type ChangeEvent } from "react";
import { Camera } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function ProfilePhotoPicker({
  value,
  initials,
  disabled,
  onChange,
  onError,
  onReadingChange,
}: {
  value: string | null;
  initials: string;
  disabled: boolean;
  onChange: (value: string | null) => void;
  onError: (message: string) => void;
  onReadingChange: (reading: boolean) => void;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [failedImage, setFailedImage] = useState<string | null>(null);

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type) || file.size > MAX_PHOTO_BYTES || !file.size) {
      onError("Choose a valid JPG, PNG or WebP photo up to 2 MB.");
      return;
    }
    onError("");
    setReading(true);
    onReadingChange(true);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setFailedImage(null);
        onChange(reader.result);
      }
    };
    reader.onerror = () => onError("Could not read this photo. Please choose another one.");
    reader.onabort = () => onError("Could not read this photo. Please choose another one.");
    reader.onloadend = () => {
      setReading(false);
      onReadingChange(false);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="mb-5">
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label={t("Upload profile photo")}
        aria-describedby="profile-photo-hint"
        className="sr-only"
        disabled={disabled || reading}
        onChange={choosePhoto}
      />
      <button
        type="button"
        className="group flex flex-col items-start gap-2 rounded-lg text-primary disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={t(value ? "Change profile photo" : "Add profile photo")}
        aria-describedby="profile-photo-hint"
        disabled={disabled || reading}
        onClick={() => input.current?.click()}
      >
        <span
          className="relative grid h-20 w-20 place-items-center overflow-hidden rounded-3xl font-display text-2xl font-bold shadow-sm ring-primary/30 transition-shadow group-hover:ring-2"
          style={{
            backgroundColor: "var(--feature-background)",
            color: "var(--feature-foreground)",
          }}
        >
          {value && value !== failedImage ? (
            <img
              src={value}
              alt={t("Profile photo")}
              className="h-full w-full object-cover"
              onError={() => setFailedImage(value)}
            />
          ) : (
            <span aria-hidden="true">{initials}</span>
          )}
          <span className="absolute bottom-0 right-0 grid h-6 w-6 place-items-center rounded-tl-lg bg-primary text-primary-foreground">
            <Camera size={13} aria-hidden="true" />
          </span>
        </span>
        <span className="text-xs font-semibold">
          {t(reading ? "Reading photo…" : value ? "Change photo" : "Add photo")}
        </span>
      </button>
      {value && (
        <button
          type="button"
          className="bf-button-link mt-2 text-xs"
          disabled={disabled || reading}
          onClick={() => onChange(null)}
        >
          {t("Remove photo")}
        </button>
      )}
      <p id="profile-photo-hint" className="mt-2 text-xs leading-5 text-muted-foreground">
        {t("JPG, PNG or WebP, up to 2 MB. Save changes to keep your photo.")}
      </p>
    </div>
  );
}
