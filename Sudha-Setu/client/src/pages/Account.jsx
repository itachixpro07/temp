import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Trash2 } from 'lucide-react';
import * as api from '../lib/api';
import { useAuth } from '../lib/useAuth';
import { listCases, forgetCase, clearChat } from '../lib/caseStore';
import { formatDate, statusLabel } from '../lib/format';
import { Empty, Notice, PageHead, Spinner, TierChip } from '../components/Ui';

const MAX_HISTORY = 30;

function Profile({ user }) {
  const rows = [
    ['Name', user.name],
    ['Email', user.email],
    ['Account type', user.role],
    ['ABHA ID', user.abhaId || 'Not linked'],
  ];

  return (
    <section className="panel p-5">
      <h2 className="text-lg">Your details</h2>
      <dl className="mt-4 divide-y divide-line">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 py-2.5 text-[15px]">
            <dt className="text-muted">{label}</dt>
            <dd className="text-right capitalize text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      {/* server-v2 exposes no endpoint that updates a user, so these fields
          are read-only rather than pretending to save. */}
      <p className="mt-4 text-sm text-muted">
        To change any of this, ask an administrator. Editing your own profile is not available yet.
      </p>
    </section>
  );
}

function History({ user }) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showLow, setShowLow] = useState(false);

  const load = useCallback(async () => {
    const remembered = listCases(user.id).slice(0, MAX_HISTORY);
    if (remembered.length === 0) {
      setCases([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const results = await Promise.all(
      remembered.map((entry) =>
        api
          .getCase(entry.caseId)
          .then((d) => d.case)
          .catch((err) => {
            // A case we no longer have access to is dropped from the local index.
            if (err.status === 404 || err.status === 403) forgetCase(user.id, entry.caseId);
            return null;
          })
      )
    );

    setCases(results.filter(Boolean));
    setLoading(false);
  }, [user.id]);

  useEffect(() => {
    load().catch((err) => {
      setError(err.message);
      setLoading(false);
    });
  }, [load]);

  const visible = showLow ? cases : cases.filter((c) => c.dangerLevel !== 'low');
  const lowCount = cases.length - cases.filter((c) => c.dangerLevel !== 'low').length;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg">Your case sheets</h2>
        {lowCount > 0 && (
          <button
            type="button"
            onClick={() => setShowLow((v) => !v)}
            className="text-sm text-tulsi underline underline-offset-4"
          >
            {showLow ? 'Hide' : 'Show'} {lowCount} low-concern {lowCount === 1 ? 'case' : 'cases'}
          </button>
        )}
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      {loading ? (
        <Spinner label="Loading your cases" />
      ) : visible.length ? (
        <ul className="space-y-3">
          {visible.map((c) => (
            <li key={c._id}>
              <Link
                to={`/cases/${c._id}`}
                className="panel flex items-center gap-4 p-4 transition-colors hover:border-tulsi"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <TierChip level={c.dangerLevel} />
                    <span className="text-sm text-muted">{statusLabel(c.status)}</span>
                  </div>
                  <p className="mt-1.5 truncate text-[15px] text-ink">
                    {c.rawDialogue?.[0]?.message || 'No description recorded'}
                  </p>
                  <p className="mt-1 text-xs text-muted">{formatDate(c.createdAt)}</p>
                </div>
                <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Empty
          title={cases.length ? 'Nothing beyond low-concern cases' : 'No case sheets yet'}
          action={
            <Link to="/" className="btn-primary">
              Describe your symptoms
            </Link>
          }
        >
          {cases.length
            ? 'Your low-concern cases are hidden. Use the link above to show them.'
            : 'Once you describe symptoms, each case sheet appears here for you to reopen or download.'}
        </Empty>
      )}

      <p className="mt-4 text-xs text-muted">
        This list is remembered by this browser. Your case sheets are stored safely on the server,
        but they will not appear here on another device until the backend can list them.
      </p>
    </section>
  );
}

function Settings({ user }) {
  const [cleared, setCleared] = useState(false);

  const clearLocal = () => {
    listCases(user.id).forEach((c) => forgetCase(user.id, c.caseId));
    clearChat(user.id);
    setCleared(true);
  };

  return (
    <section className="panel p-5">
      <h2 className="text-lg">Settings</h2>
      <p className="mt-2 max-w-reading text-[15px] text-muted">
        Clear the case and chat history this browser remembers. Nothing is deleted from your
        medical record on the server.
      </p>
      <button type="button" onClick={clearLocal} className="btn-quiet mt-4">
        <Trash2 size={16} aria-hidden="true" />
        Clear history on this device
      </button>
      {cleared && (
        <p className="mt-3 text-sm text-tulsi">Cleared. Reload the page to see the change.</p>
      )}
    </section>
  );
}

function About() {
  return (
    <section className="panel p-5">
      <h2 className="text-lg">About Sudha Setu</h2>
      <div className="mt-3 max-w-reading space-y-3 text-[15px] leading-relaxed text-muted">
        <p>
          Ayush OPDs run long queues, and much of the consultation gets spent gathering a history
          that could have been captured while the patient waited. Sudha Setu captures it first —
          in Hindi or English, by voice or text — including Ayurvedic parameters like Prakriti and
          Agni, so the physician starts with a structured case sheet rather than a blank page.
        </p>
        <p>
          What you describe is checked against a knowledge base that Ayush doctors have written
          and approved. Mild complaints get verified self-care advice. Anything that needs a
          physician is queued for one. Anything urgent triggers emergency guidance immediately.
        </p>
        <p>
          Built for problem statement SIH26047, Ministry of Ayush, by team Relic. Sudha Setu does
          not diagnose and does not replace your doctor.
        </p>
      </div>
    </section>
  );
}

export default function Account() {
  const { user } = useAuth();

  return (
    <div>
      <PageHead title={user.name}>{user.email}</PageHead>
      <div className="space-y-8">
        <History user={user} />
        <Profile user={user} />
        <Settings user={user} />
        <About />
      </div>
    </div>
  );
}
