import { useEffect, useRef, useState } from 'react';
import { MapPin, Phone, X } from 'lucide-react';

// Shown when POST /api/cases/intake comes back with emergency: true
// (i.e. the triage engine classified dangerLevel as 'high').
//
// The emergency numbers are plain tel: links and need no backend. There is
// deliberately no "nearest hospitals" list here: server-v2 has a Hospital
// model but no route that serves it, and inventing hospital data in a
// medical emergency screen would be dangerous.
export default function SosModal({ open, caseId, onClose }) {
  const [coords, setCoords] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState(null);
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const ping = () => {
    if (!navigator.geolocation) {
      setLocError('This browser cannot share your location. Read your address out on the call.');
      return;
    }
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocError('Location is blocked. Allow it in your browser, or read your address out on the call.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="sos-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-tier-high p-5 text-white"
    >
      <div className="w-full max-w-lg">
        <h2 id="sos-title" className="font-serif text-3xl leading-tight sm:text-4xl">
          Get help now
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-white/90">
          What you described can be life-threatening. Call emergency services before doing
          anything else. Your case has been recorded for the doctor.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <a
            href="tel:108"
            className="flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-4 text-lg font-semibold text-tier-high"
          >
            <Phone size={20} aria-hidden="true" />
            Call 108 — ambulance
          </a>
          <a
            href="tel:112"
            className="flex items-center justify-center gap-2 rounded-lg bg-white/15 px-4 py-4 text-lg font-semibold text-white ring-1 ring-inset ring-white/40"
          >
            <Phone size={20} aria-hidden="true" />
            Call 112 — emergency
          </a>
        </div>

        <div className="mt-5 rounded-lg bg-white/10 p-4">
          <button type="button" onClick={ping} className="flex items-center gap-2 font-medium">
            <MapPin size={18} aria-hidden="true" />
            {locating ? 'Finding your location…' : 'Show my location to read out'}
          </button>

          {coords && (
            <p className="mt-2 select-all font-mono text-sm text-white/90">
              {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </p>
          )}
          {locError && <p className="mt-2 text-sm text-white/80">{locError}</p>}
        </div>

        <div className="mt-6 flex items-center gap-4">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 text-sm text-white/80 underline underline-offset-4 hover:text-white"
          >
            <X size={15} aria-hidden="true" />
            Close this screen
          </button>
          {caseId && <span className="text-xs text-white/60">Case {String(caseId).slice(-8)}</span>}
        </div>
      </div>
    </div>
  );
}
