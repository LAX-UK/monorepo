function SocialIconYoutube({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <title>YouTube</title>
      <path
        fill="currentColor"
        d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.7 31.7 0 0 0 0 12a31.7 31.7 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1 31.7 31.7 0 0 0 .5-5.8 31.7 31.7 0 0 0-.5-5.8ZM9.7 15.5V8.5L15.8 12 9.7 15.5Z"
      />
    </svg>
  );
}

function SocialIconFacebook({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <title>Facebook</title>
      <path
        fill="currentColor"
        d="M22 12a10 10 0 1 0-11.5 9.9v-7H7V12h3.5V9.8c0-3.5 2.1-5.4 5.3-5.4 1.5 0 3.1.3 3.1.3v3.4h-1.7c-1.7 0-2.2 1-2.2 2.1V12h3.8l-.6 3.9h-3.2v7A10 10 0 0 0 22 12Z"
      />
    </svg>
  );
}

function SocialIconInstagram({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <title>Instagram</title>
      <path
        fill="currentColor"
        d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7Zm5 3.5A4.5 4.5 0 1 1 7.5 12 4.5 4.5 0 0 1 12 7.5Zm0 2A2.5 2.5 0 1 0 14.5 12 2.5 2.5 0 0 0 12 9.5ZM17.8 6.3a1 1 0 1 1-1 1 1 1 0 0 1 1-1Z"
      />
    </svg>
  );
}

function SocialIconLinkedIn({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <title>LinkedIn</title>
      <path
        fill="currentColor"
        d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 8.75h4V21H3V8.75Zm7.5 0h3.8v1.7h.1c.5-1 1.8-2 3.7-2 4 0 4.7 2.6 4.7 6v7.5h-4V15c0-1.6 0-3.6-2.2-3.6-2.2 0-2.5 1.7-2.5 3.5V21h-4V8.75Z"
      />
    </svg>
  );
}

const socialClass =
  "h-6 w-6 text-brand-800 transition-opacity hover:opacity-70 dark:text-on-surface";

export function FooterSocials() {
  return (
    <div className="flex flex-row items-center gap-4">
      <a
        href="https://www.youtube.com"
        className={socialClass}
        aria-label="YouTube"
        rel="noreferrer noopener"
        target="_blank"
      >
        <SocialIconYoutube />
      </a>
      <a
        href="https://www.facebook.com"
        className={socialClass}
        aria-label="Facebook"
        rel="noreferrer noopener"
        target="_blank"
      >
        <SocialIconFacebook />
      </a>
      <a
        href="https://www.instagram.com"
        className={socialClass}
        aria-label="Instagram"
        rel="noreferrer noopener"
        target="_blank"
      >
        <SocialIconInstagram />
      </a>
      <a
        href="https://www.linkedin.com"
        className={socialClass}
        aria-label="LinkedIn"
        rel="noreferrer noopener"
        target="_blank"
      >
        <SocialIconLinkedIn />
      </a>
    </div>
  );
}
