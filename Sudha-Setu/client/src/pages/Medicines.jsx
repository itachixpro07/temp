import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import * as api from '../lib/api';
import { Empty, Notice, PageHead, Spinner } from '../components/Ui';

// NOTE ON DATA SOURCE
// server-v2 has no Medicine model or /api/medicines route. Rather than invent
// a fake catalogue, this page is built from the doctor-verified advice already
// stored on KnowledgeBase rules: verifiedAdvice.safeRemedies and
// verifiedAdvice.ayurvedicDietaryNotes. Each remedy is shown with the
// conditions it was approved for, so nothing is presented without context.

const PAGE_LIMIT = 100; // the endpoint caps limit at 100
const MAX_PAGES = 5;

const useRemedies = () => {
  const [rules, setRules] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;

    const loadAll = async () => {
      try {
        const first = await api.listRules({ page: 1, limit: PAGE_LIMIT });
        let all = first.rules || [];
        const pages = Math.min(first.totalPages || 1, MAX_PAGES);

        for (let p = 2; p <= pages; p += 1) {
          // Sequential on purpose: this is a cold, cacheable read and we would
          // rather not fan out requests at the API.
          // eslint-disable-next-line no-await-in-loop
          const next = await api.listRules({ page: p, limit: PAGE_LIMIT });
          all = all.concat(next.rules || []);
        }

        if (alive) setRules(all);
      } catch (err) {
        if (alive) setError(err.message);
      } finally {
        if (alive) setLoading(false);
      }
    };

    loadAll();
    return () => {
      alive = false;
    };
  }, []);

  return { rules, loading, error };
};

export default function Medicines() {
  const { rules, loading, error } = useRemedies();
  const [search, setSearch] = useState('');

  // Collapse the same remedy appearing under several conditions into one entry.
  const remedies = useMemo(() => {
    if (!rules) return [];
    const index = new Map();

    for (const rule of rules) {
      const condition = rule.keywordTriggers?.[0];
      const advice = rule.verifiedAdvice || {};

      for (const [kind, items] of [
        ['Remedy', advice.safeRemedies],
        ['Diet and routine', advice.ayurvedicDietaryNotes],
      ]) {
        for (const text of items || []) {
          const key = `${kind}::${text.toLowerCase()}`;
          if (!index.has(key)) index.set(key, { kind, text, conditions: new Set() });
          if (condition) index.get(key).conditions.add(condition);
        }
      }
    }

    return [...index.values()]
      .map((r) => ({ ...r, conditions: [...r.conditions] }))
      .sort((a, b) => a.text.localeCompare(b.text));
  }, [rules]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return remedies;
    return remedies.filter(
      (r) => r.text.toLowerCase().includes(q) || r.conditions.some((c) => c.includes(q))
    );
  }, [remedies, search]);

  return (
    <div>
      <PageHead title="Remedies">
        Home remedies and dietary guidance that Ayush doctors have approved in the knowledge base.
        Nothing here is a prescription — only a doctor can prescribe medicine to you.
      </PageHead>

      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          aria-hidden="true"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search a remedy or a condition"
          aria-label="Search remedies"
          className="field pl-9"
        />
      </div>

      <div className="mt-6">
        {error && <Notice tone="error">{error}</Notice>}

        {loading ? (
          <Spinner label="Loading remedies" />
        ) : visible.length ? (
          <>
            <p className="mb-4 text-sm text-muted">
              {visible.length} {visible.length === 1 ? 'entry' : 'entries'}
            </p>
            <ul className="space-y-3">
              {visible.map((r) => (
                <li key={`${r.kind}-${r.text}`} className="panel p-4">
                  <p className="text-[15px] leading-relaxed text-ink">{r.text}</p>
                  <p className="mt-2 text-xs text-muted">
                    {r.kind}
                    {r.conditions.length > 0 && ` · approved for ${r.conditions.join(', ')}`}
                  </p>
                </li>
              ))}
            </ul>
          </>
        ) : (
          !error && (
            <Empty title={search ? 'Nothing matched that' : 'No remedies published yet'}>
              {search
                ? 'Try a different word.'
                : 'Remedies appear here once doctors add verified advice to the knowledge base.'}
            </Empty>
          )
        )}
      </div>
    </div>
  );
}
