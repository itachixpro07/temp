import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download } from 'lucide-react';
import * as api from '../lib/api';
import { confidencePercent, formatDate, statusLabel } from '../lib/format';
import { Notice, PageHead, Spinner, TierChip } from '../components/Ui';

const MARKER_LABELS = {
  suspectedPrakriti: 'Prakriti',
  agniStatus: 'Agni',
  dietHabits: 'Diet',
  sleepPattern: 'Sleep',
};

const SENDER_LABELS = {
  patient: 'You',
  bot: 'Sudha Setu',
  doctor: 'Doctor',
  support: 'Support desk',
};

function Section({ title, children }) {
  return (
    <section className="panel p-5">
      <h2 className="text-lg">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default function CaseDetail() {
  const { id } = useParams();
  const [caseSheet, setCaseSheet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .getCase(id)
      .then((d) => alive && setCaseSheet(d.case))
      .catch((err) => alive && setError(err.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  // Fetched with credentials and opened as a blob: a direct link would not
  // carry the SameSite=strict auth cookie in production.
  const openPdf = async () => {
    setPdfBusy(true);
    setPdfError(null);
    let url;
    try {
      url = await api.casePdfUrl(id);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      setPdfError(err.message);
    } finally {
      if (url) setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setPdfBusy(false);
    }
  };

  if (loading) return <Spinner label="Loading case sheet" />;

  if (error) {
    return (
      <div>
        <Notice tone="error">{error}</Notice>
        <Link to="/account" className="btn-quiet mt-4">
          <ArrowLeft size={16} aria-hidden="true" />
          Back to your cases
        </Link>
      </div>
    );
  }

  if (!caseSheet) return null;

  const markers = caseSheet.ayurvedicMarkers || {};
  const shownMarkers = Object.entries(MARKER_LABELS).filter(
    ([key]) => markers[key] && markers[key] !== 'unknown'
  );
  const confidence = confidencePercent(caseSheet.confidenceScore);

  return (
    <div>
      <Link to="/account" className="btn-ghost -ml-4 mb-2">
        <ArrowLeft size={16} aria-hidden="true" />
        Your cases
      </Link>

      <PageHead title="Case sheet">{formatDate(caseSheet.createdAt)}</PageHead>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <TierChip level={caseSheet.dangerLevel} />
        <span className="text-sm text-muted">{statusLabel(caseSheet.status)}</span>
        {confidence && <span className="text-sm text-muted">Match confidence {confidence}</span>}

        <button type="button" onClick={openPdf} disabled={pdfBusy} className="btn-quiet ml-auto">
          <Download size={16} aria-hidden="true" />
          {pdfBusy ? 'Preparing…' : 'Download PDF'}
        </button>
      </div>

      {pdfError && (
        <div className="mb-6">
          <Notice tone="error">{pdfError}</Notice>
        </div>
      )}

      <div className="space-y-4">
        {caseSheet.rawDialogue?.length > 0 && (
          <Section title="What was described">
            <ul className="space-y-3">
              {caseSheet.rawDialogue.map((turn, i) => (
                <li key={`${turn.timestamp}-${i}`}>
                  <p className="text-xs text-muted">
                    {SENDER_LABELS[turn.sender] || turn.sender}
                    {turn.timestamp ? ` · ${formatDate(turn.timestamp)}` : ''}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-ink">
                    {turn.message}
                  </p>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {caseSheet.symptoms?.length > 0 && (
          <Section title="Symptoms recorded">
            <ul className="space-y-2">
              {caseSheet.symptoms.map((s) => (
                <li key={s.name} className="text-[15px] capitalize text-ink">
                  {s.name}
                  {(s.duration || s.severity) && (
                    <span className="ml-2 text-sm normal-case text-muted">
                      {[s.duration, s.severity ? `severity ${s.severity}/10` : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {shownMarkers.length > 0 && (
          <Section title="Ayurvedic assessment">
            <dl className="divide-y divide-line">
              {shownMarkers.map(([key, label]) => (
                <div key={key} className="flex justify-between gap-4 py-2.5 text-[15px]">
                  <dt className="text-muted">{label}</dt>
                  <dd className="text-right capitalize text-ink">{markers[key]}</dd>
                </div>
              ))}
            </dl>
          </Section>
        )}

        {caseSheet.doctorNotes && (
          <Section title="Doctor's notes">
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">
              {caseSheet.doctorNotes}
            </p>
          </Section>
        )}

        {caseSheet.prescription?.length > 0 && (
          <Section title="Prescription">
            <ul className="divide-y divide-line">
              {caseSheet.prescription.map((rx, i) => (
                <li key={`${rx.medicineName}-${i}`} className="py-3 first:pt-0 last:pb-0">
                  <p className="text-[15px] font-medium text-ink">{rx.medicineName}</p>
                  {(rx.dosage || rx.timing || rx.duration) && (
                    <p className="mt-1 text-sm text-muted">
                      {[rx.dosage, rx.timing, rx.duration].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {rx.instructions && (
                    <p className="mt-1 text-sm text-muted">{rx.instructions}</p>
                  )}
                </li>
              ))}
            </ul>
            {caseSheet.assignedDoctorId?.name && (
              <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
                Prescribed by {caseSheet.assignedDoctorId.name}
              </p>
            )}
          </Section>
        )}
      </div>
    </div>
  );
}
