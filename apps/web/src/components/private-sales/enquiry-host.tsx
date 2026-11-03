"use client";

import type { EnquiryPath } from "@/lib/private-sales/enquiry-values";
import { useState } from "react";
import { EnquiryCard } from "./enquiry-card";

/** The enquiry form, started over when the sender chooses to send another. */
export function EnquiryHost({ initialPath }: { initialPath: EnquiryPath }) {
  const [attempt, setAttempt] = useState(0);
  const [path, setPath] = useState(initialPath);
  return (
    <EnquiryCard
      key={attempt}
      initialPath={path}
      onAnother={(last) => {
        setPath(last);
        setAttempt((count) => count + 1);
      }}
    />
  );
}
