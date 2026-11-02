import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { Button, Card } from './ui';

// Chrome/Edge/Android fire this once the app is installable; we keep it to show our own button.
let deferredPrompt = null;
const listeners = new Set();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    listeners.forEach((fn) => fn());
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    listeners.forEach((fn) => fn());
  });
}

const isInstalled = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const DISMISS_KEY = 'installDismissedAt';

function recentlyDismissed() {
  try {
    const t = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return Date.now() - t < 3 * 24 * 60 * 60 * 1000; // hide for 3 days after "Not now"
  } catch {
    return false;
  }
}

/** "Install app" card: one-tap install on Android/PC, instructions on iPhone. Hidden once installed. */
export default function InstallApp() {
  const [, force] = useState(0);
  const [hidden, setHidden] = useState(recentlyDismissed);

  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);

  if (hidden || isInstalled()) return null;
  const ios = isIos();
  if (!deferredPrompt && !ios) return null; // browser can't install right now

  const install = async () => {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    force((n) => n + 1);
  };

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setHidden(true);
  };

  return (
    <Card className="mb-4 flex items-start gap-3 p-3">
      <img src="/pwa-192.png" alt="" className="h-11 w-11 shrink-0 rounded-xl ring-1 ring-slate-200" />
      <div className="min-w-0 flex-1 text-sm">
        <div className="font-bold">Install Dealer Ledger app</div>
        {ios ? (
          <div className="mt-0.5 text-xs text-slate-600">
            Tap <Share className="inline h-3.5 w-3.5" /> <b>Share</b> at the bottom of Safari, then <b>“Add to Home Screen”</b>.
          </div>
        ) : (
          <div className="mt-0.5 text-xs text-slate-600">Opens from your home screen like a normal app.</div>
        )}
        {!ios && (
          <Button size="sm" className="mt-2" onClick={install}>
            <Download className="h-4 w-4" /> Install app
          </Button>
        )}
      </div>
      <button onClick={dismiss} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Not now">
        <X className="h-4 w-4" />
      </button>
    </Card>
  );
}
