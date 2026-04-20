export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1 font-footer-links text-xs text-error">
      {message}
    </p>
  );
}

export function FormBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="font-footer-links text-sm text-error">
      {message}
    </p>
  );
}
