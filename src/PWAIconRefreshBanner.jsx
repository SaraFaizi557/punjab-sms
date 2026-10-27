import React, { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  dismissIosIconReaddHint,
  isIosDevice,
  isStandalonePwa,
  peekIosIconReaddHint,
} from "./pwaIconSync.js";

/**
 * iOS freezes the Home Screen icon at install time. When we ship a new mark,
 * prompt standalone iOS users once to re-add the app so the launcher icon updates.
 */
export default function PWAIconRefreshBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || window.__TAURI__) return;
    if (!isStandalonePwa() || !isIosDevice()) return;
    if (peekIosIconReaddHint()) setOpen(true);
  }, []);

  if (!open) return null;

  const close = () => {
    dismissIosIconReaddHint();
    setOpen(false);
  };

  return (
    <Card className="fixed bottom-4 left-4 right-4 z-[1001] border-primary/25 bg-card shadow-lg sm:left-auto sm:right-4 sm:max-w-md">
      <CardContent className="flex items-start gap-3 p-3 sm:p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <RefreshCw className="size-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold">App icon updated</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            iPhone/iPad keeps the old Home Screen icon. To refresh it: delete Punjab-SMS from the
            Home Screen, open this page in Safari, then tap Share → Add to Home Screen.
          </p>
        </div>
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Dismiss" onClick={close}>
          <X className="size-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
