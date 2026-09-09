import { useState } from 'react';
import { ExternalLink, MapPin, Phone } from 'lucide-react';
import { Notice, PageHead } from '../components/Ui';

// NOTE ON DATA SOURCE
// server-v2 defines models/Hospital.js (name, location.lat/lng, phone,
// emergencyCapable) but never imports it — there is no controller and no
// route, so there is no endpoint to list hospitals.
//
// Inventing hospital names and phone numbers on a page people may reach in an
// emergency would be unsafe, so this page ships no fabricated directory. It
// gives the real emergency numbers, which need no backend, and hands off to
// maps for the "near me" lookup until GET /api/hospitals exists.

export default function Hospitals() {
  const [coords, setCoords] = useState(null);
  const [status, setStatus] = useState(null);

  const locate = () => {
    if (!navigator.geolocation) {
      setStatus('This browser cannot share your location.');
      return;
    }
    setStatus('Finding you…');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords({ lat: p.coords.latitude, lng: p.coords.longitude });
        setStatus(null);
      },
      () => setStatus('Location is blocked. Allow it in your browser settings to search nearby.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const mapsUrl = coords
    ? `https://www.google.com/maps/search/hospital/@${coords.lat},${coords.lng},14z`
    : 'https://www.google.com/maps/search/hospital+near+me';

  return (
    <div>
      <PageHead title="Hospitals">
        If this is an emergency, call first and travel second.
      </PageHead>

      <div className="grid gap-3 sm:grid-cols-2">
        <a
          href="tel:108"
          className="panel flex items-center gap-3 p-5 transition-colors hover:border-tier-high"
        >
          <Phone size={22} className="text-tier-high" aria-hidden="true" />
          <span>
            <span className="block text-lg font-medium text-ink">108</span>
            <span className="text-sm text-muted">Ambulance</span>
          </span>
        </a>

        <a
          href="tel:112"
          className="panel flex items-center gap-3 p-5 transition-colors hover:border-tier-high"
        >
          <Phone size={22} className="text-tier-high" aria-hidden="true" />
          <span>
            <span className="block text-lg font-medium text-ink">112</span>
            <span className="text-sm text-muted">All emergencies</span>
          </span>
        </a>
      </div>

      <section className="panel mt-6 p-5">
        <h2 className="text-lg">Find a hospital near you</h2>
        <p className="mt-2 max-w-reading text-[15px] text-muted">
          Share your location and we will open a map of hospitals around you.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={locate} className="btn-quiet">
            <MapPin size={16} aria-hidden="true" />
            {coords ? 'Update my location' : 'Use my location'}
          </button>

          <a href={mapsUrl} target="_blank" rel="noreferrer" className="btn-primary">
            <ExternalLink size={16} aria-hidden="true" />
            Open map
          </a>
        </div>

        {coords && (
          <p className="mt-3 select-all font-mono text-sm text-muted">
            {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </p>
        )}
        {status && <p className="mt-3 text-sm text-muted">{status}</p>}
      </section>

      <div className="mt-6">
        <Notice>
          A searchable in-app hospital directory is not available yet. The backend has a Hospital
          model but no endpoint that serves it, and listing hospitals we cannot verify would be
          unsafe — so this page uses maps instead.
        </Notice>
      </div>
    </div>
  );
}
