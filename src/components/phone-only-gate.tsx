import { useLayoutEffect, useState, type ReactNode } from "react";

function isPhoneBrowser() {
  if (typeof navigator === "undefined") return true;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent || "",
  );
}

export function PhoneOnlyGate({ children }: { children: ReactNode }) {
  const [blocked, setBlocked] = useState(false);

  useLayoutEffect(() => {
    setBlocked(!isPhoneBrowser());
  }, []);

  if (!blocked) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-6">
      <div
        role="alertdialog"
        aria-labelledby="vaani-phone-only-title"
        aria-describedby="vaani-phone-only-sub"
        className="w-full max-w-sm rounded-[var(--radius-xl)] border border-line bg-surface p-6 text-center shadow-lg"
      >
        <p id="vaani-phone-only-title" className="text-lg font-medium text-ink">
          Please Login on Phone Browser.
        </p>
        <p id="vaani-phone-only-sub" className="mt-2 text-sm text-muted">
          The Project is based on Pull Directory Concept
        </p>
      </div>
    </div>
  );
}
