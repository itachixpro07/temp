import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import * as api from '../lib/api';
import { tier } from '../lib/format';
import { Empty, Notice, PageHead, Spinner, TierChip } from '../components/Ui';

const FILTERS = [
  ['', 'All'],
  ['low', 'Low concern'],
  ['medium', 'Needs a doctor'],
  ['high', 'Urgent'],
];

function AdviceBlock({ label, items }) {
  if (!items?.length) return null;
  return (
    <div className="mt-3">
      <h3 className="text-sm font-medium text-ink">{label}</h3>
      <ul className="mt-1.5 space-y-1">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm text-muted">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-tulsi" aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RuleCard({ rule }) {
  const advice = rule.verifiedAdvice || {};
  const hasAdvice = ['generalTips', 'ayurvedicDietaryNotes', 'safeRemedies'].some(
    (k) => advice[k]?.length
  );
  const t = tier(rule.dangerClassification);

  return (
    <article className={`panel border-l-4 p-5 ${
      rule.dangerClassification === 'high'
        ? 'border-l-tier-high'
        : rule.dangerClassification === 'medium'
          ? 'border-l-tier-med'
          : 'border-l-tier-low'
    }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-lg capitalize">{rule.keywordTriggers?.[0] || 'Unnamed pattern'}</h2>
        <TierChip level={rule.dangerClassification} />
      </div>

      {rule.keywordTriggers?.length > 1 && (
        <p className="mt-1.5 text-sm text-muted">
          Also recognised as {rule.keywordTriggers.slice(1).join(', ')}
        </p>
      )}

      {hasAdvice ? (
        <>
          <AdviceBlock label="General care" items={advice.generalTips} />
          <AdviceBlock label="Diet and routine" items={advice.ayurvedicDietaryNotes} />
          <AdviceBlock label="Safe home remedies" items={advice.safeRemedies} />
        </>
      ) : (
        <p className={`mt-3 text-sm ${t.tone}`}>
          {rule.dangerClassification === 'high'
            ? 'No self-care advice is published for this. Seek medical help.'
            : 'A doctor reviews this pattern before advice is given.'}
        </p>
      )}

      {rule.verifiedByDoctorId?.name && (
        <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
          Verified by {rule.verifiedByDoctorId.name}
        </p>
      )}
    </article>
  );
}

export default function Diseases() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [dangerLevel, setDangerLevel] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    api
      .listRules({ search: query, dangerLevel, page, limit: 20 })
      .then((d) => alive && setData(d))
      .catch((err) => alive && setError(err.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [query, dangerLevel, page]);

  const applySearch = (e) => {
    e.preventDefault();
    setPage(1);
    setQuery(search.trim());
  };

  return (
    <div>
      <PageHead title="Conditions">
        Every entry here was written and approved by an Ayush doctor. This is the same knowledge
        base your symptoms are checked against.
      </PageHead>

      <form onSubmit={applySearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search a symptom, like fever or khansi"
            aria-label="Search conditions"
            className="field pl-9"
          />
        </div>
        <button type="submit" className="btn-quiet">
          Search
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {FILTERS.map(([value, label]) => (
          <button
            key={value || 'all'}
            type="button"
            onClick={() => {
              setPage(1);
              setDangerLevel(value);
            }}
            aria-pressed={dangerLevel === value}
            className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
              dangerLevel === value
                ? 'bg-ink text-paper'
                : 'bg-sage text-muted hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {error && <Notice tone="error">{error}</Notice>}

        {loading ? (
          <Spinner label="Loading conditions" />
        ) : data?.rules?.length ? (
          <>
            <p className="mb-4 text-sm text-muted">
              {data.total} {data.total === 1 ? 'entry' : 'entries'}
            </p>
            <div className="space-y-4">
              {data.rules.map((rule) => (
                <RuleCard key={rule._id} rule={rule} />
              ))}
            </div>

            {data.totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <button
                  type="button"
                  className="btn-quiet"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </button>
                <span className="text-sm text-muted">
                  Page {data.page} of {data.totalPages}
                </span>
                <button
                  type="button"
                  className="btn-quiet"
                  disabled={page >= data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        ) : (
          !error && (
            <Empty title="Nothing matched that">
              Try a different word, or clear the filter. If the knowledge base is empty, run
              <code className="mx-1 rounded bg-sage px-1.5 py-0.5 text-xs">npm run seed</code>
              in server-v2.
            </Empty>
          )
        )}
      </div>
    </div>
  );
}
