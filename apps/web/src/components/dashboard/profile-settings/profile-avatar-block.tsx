"use client";

import { ImageUploadField } from "@/components/forms/image-upload-field";
import { updateProfileImageAction } from "@/lib/actions/profile";
import { notify } from "@/lib/ui/notify";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function ProfileAvatarBlock({ initialImage }: { initialImage: string | null }) {
  const [value, setValue] = useState(initialImage ? [initialImage] : []);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function persist(next: string[]) {
    const previous = value;
    startTransition(async () => {
      const r = await updateProfileImageAction({ image: next[0] ?? null });
      if (r.ok) {
        setValue(next);
        notify.success("Profile image updated");
        router.refresh();
        return;
      }
      setValue(previous);
      notify.error(r.error);
    });
  }

  return (
    <div className="rounded-xl border border-border-hairline bg-surface-container-lowest p-6">
      <p className="font-label text-sm font-bold uppercase tracking-wide text-on-surface">
        Profile photo
      </p>
      <p className="mt-1 font-body text-sm text-on-surface-variant">
        Shown on your profile and bidding account.
      </p>
      <div className="mt-4 max-w-md">
        <ImageUploadField kind="avatar" maxFiles={1} value={value} onChange={persist} />
        {pending ? <p className="mt-2 font-body text-xs text-on-surface-variant">Saving…</p> : null}
      </div>
    </div>
  );
}
