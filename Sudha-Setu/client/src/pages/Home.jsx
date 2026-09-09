import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Mic, Send, Square } from 'lucide-react';
import * as api from '../lib/api';
import { useAuth } from '../lib/useAuth';
import { useSpeech, detectLocale } from '../lib/useSpeech';
import { rememberCase, rememberChat, lastChat } from '../lib/caseStore';
import { confidencePercent, statusLabel, tier } from '../lib/format';
import { Notice, TierChip } from '../components/Ui';
import SosModal from '../components/SosModal';

const MAX_INTAKE = 5000; // matches MAX_TEXT_LENGTH in caseController.js
const MAX_CHAT = 2000; // matches MAX_MESSAGE_LENGTH in aiController.js

/* ------------------------------------------------------------- intake --- */

function IntakePanel({ user }) {
  const [text, setText] = useState('');
  const [shareLocation, setShareLocation] = useState(false);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sos, setSos] = useState(false);
  const speech = useSpeech();

  // Voice fills the same box the user can type into, so the two modes never
  // diverge and edits are always possible before sending.
  useEffect(() => {
    if (speech.transcript) setText(speech.transcript);
  }, [speech.transcript]);

  const getLocation = () =>
    new Promise((resolve) => {
      if (!shareLocation || !navigator.geolocation) return resolve(undefined);
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve(undefined),
        { timeout: 8000 }
      );
    });

  const submit = async (e) => {
    e.preventDefault();
    const patientText = text.trim();
    if (!patientText || busy) return;

    speech.stop();
    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const location = await getLocation();
      const res = await api.intake({
        patientText,
        languageUsed: detectLocale().toLowerCase(),
        ...(location ? { location } : {}),
      });

      setResult(res);
      rememberCase(user.id, res);
      if (res.emergency) setSos(true);
      setText('');
      speech.setTranscript('');
    } catch (err) {
      setError(
        err.status === 403
          ? 'Only patient accounts can submit symptoms. You are signed in with a different role.'
          : err.message
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SosModal open={sos} caseId={result?.caseId} onClose={() => setSos(false)} />

      <form onSubmit={submit}>
        <div className="flex flex-col items-center py-6">
          <div className="relative">
            {speech.listening && <span className="halo absolute inset-0" aria-hidden="true" />}
            <button
              type="button"
              onClick={speech.listening ? speech.stop : speech.start}
              disabled={!speech.supported}
              aria-pressed={speech.listening}
              aria-label={speech.listening ? 'Stop recording' : 'Start speaking'}
              className={`relative flex h-24 w-24 items-center justify-center rounded-full transition-colors ${
                speech.listening
                  ? 'bg-tier-high text-white'
                  : 'bg-tulsi text-white hover:bg-tulsi-deep disabled:bg-line disabled:text-muted'
              }`}
            >
              {speech.listening ? <Square size={30} /> : <Mic size={34} />}
            </button>
          </div>

          <p className="mt-4 text-center text-[15px] text-muted">
            {!speech.supported
              ? 'Voice input needs Chrome or Edge. You can type below instead.'
              : speech.listening
                ? 'Listening — speak in Hindi or English, then tap to stop.'
                : 'Tap and describe what you are feeling, or type below.'}
          </p>
        </div>

        <label htmlFor="symptoms" className="label">
          What is troubling you?
        </label>
        <textarea
          id="symptoms"
          rows={5}
          value={text}
          maxLength={MAX_INTAKE}
          onChange={(e) => setText(e.target.value)}
          placeholder="Since when, where it hurts, how bad it feels, anything else you noticed…"
          className="field resize-y"
        />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={shareLocation}
              onChange={(e) => setShareLocation(e.target.checked)}
              className="h-4 w-4 rounded border-line text-tulsi focus:ring-tulsi"
            />
            Share my location if this turns out to be urgent
          </label>

          <button type="submit" className="btn-primary" disabled={!text.trim() || busy}>
            <Send size={16} aria-hidden="true" />
            {busy ? 'Checking…' : 'Send to triage'}
          </button>
        </div>

        {speech.error && (
          <div className="mt-4">
            <Notice tone="error">{speech.error}</Notice>
          </div>
        )}
        {error && (
          <div className="mt-4">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
      </form>

      {result && <IntakeResult result={result} onReopenSos={() => setSos(true)} />}
    </>
  );
}

function AdviceList({ title, items }) {
  if (!items?.length) return null;
  return (
    <div className="mt-4">
      <h4 className="text-sm font-medium text-ink">{title}</h4>
      <ul className="mt-1.5 space-y-1.5">
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

function IntakeResult({ result, onReopenSos }) {
  const t = tier(result.dangerLevel);
  const advice = result.verifiedAdvice;
  const confidence = confidencePercent(result.confidenceScore);

  return (
    <section
      aria-live="polite"
      className={`panel mt-8 border-l-4 p-5 ${
        result.dangerLevel === 'high'
          ? 'border-l-tier-high'
          : result.dangerLevel === 'medium'
            ? 'border-l-tier-med'
            : 'border-l-tier-low'
      }`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <TierChip level={result.dangerLevel} />
        <span className="text-sm text-muted">{statusLabel(result.status)}</span>
        {confidence && (
          <span className="ml-auto text-xs text-muted">Match confidence {confidence}</span>
        )}
      </div>

      <h3 className={`mt-3 text-xl ${t.tone}`}>
        {result.dangerLevel === 'high'
          ? 'Seek emergency care now'
          : result.dangerLevel === 'medium'
            ? 'A doctor should look at this'
            : 'You can likely manage this at home'}
      </h3>

      {result.requiresHumanReview && result.dangerLevel !== 'high' && (
        <p className="mt-2 max-w-reading text-sm text-muted">
          A doctor will review what you wrote before any advice is confirmed.
        </p>
      )}

      {advice ? (
        <>
          <AdviceList title="General care" items={advice.generalTips} />
          <AdviceList title="Diet and routine" items={advice.ayurvedicDietaryNotes} />
          <AdviceList title="Safe home remedies" items={advice.safeRemedies} />
        </>
      ) : (
        result.dangerLevel === 'low' && (
          <p className="mt-3 max-w-reading text-sm text-muted">
            No doctor-verified advice matched your description closely enough to show here.
          </p>
        )
      )}

      {result.matchedKeywords?.length > 0 && (
        <p className="mt-4 text-sm text-muted">
          Picked up on: {result.matchedKeywords.join(', ')}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <Link to={`/cases/${result.caseId}`} className="btn-quiet">
          <FileText size={16} aria-hidden="true" />
          Open case sheet
        </Link>
        {result.emergency && (
          <button type="button" onClick={onReopenSos} className="btn-primary bg-tier-high hover:bg-tier-high">
            Show emergency numbers
          </button>
        )}
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- chat --- */

function ChatPanel({ user }) {
  const [messages, setMessages] = useState([]);
  const [chatId, setChatId] = useState(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const endRef = useRef(null);
  const speech = useSpeech();

  useEffect(() => {
    if (speech.transcript) setDraft(speech.transcript);
  }, [speech.transcript]);

  // Resume the last session this browser started. See caseStore.js for why
  // the id has to be remembered client-side.
  useEffect(() => {
    const previous = lastChat(user.id);
    if (!previous) return;
    api
      .getChat(previous)
      .then((d) => {
        setChatId(d.chatId);
        setMessages(d.messages || []);
      })
      .catch(() => {
        /* session gone - start fresh */
      });
  }, [user.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    const message = draft.trim();
    if (!message || busy) return;

    speech.stop();
    setDraft('');
    speech.setTranscript('');
    setError(null);
    setMessages((m) => [...m, { sender: 'user', content: message, timestamp: new Date().toISOString() }]);
    setBusy(true);

    try {
      const res = await api.sendChat({ message, chatId });
      setChatId(res.chatId);
      rememberChat(user.id, res.chatId);
      setMessages((m) => [...m, { sender: 'ai', content: res.reply, timestamp: new Date().toISOString() }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="panel min-h-[18rem] p-4">
        {messages.length === 0 ? (
          <p className="py-12 text-center text-[15px] text-muted">
            Ask about a symptom, a remedy, or what to expect at your OPD visit.
          </p>
        ) : (
          <ul className="space-y-3">
            {messages.map((m, i) => (
              <li
                key={`${m.timestamp}-${i}`}
                className={m.sender === 'user' ? 'flex justify-end' : 'flex justify-start'}
              >
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3.5 py-2.5 text-[15px] leading-relaxed ${
                    m.sender === 'user' ? 'bg-tulsi text-white' : 'bg-sage text-ink'
                  }`}
                >
                  {m.content}
                </div>
              </li>
            ))}
            {busy && (
              <li className="flex justify-start">
                <div className="rounded-xl bg-sage px-3.5 py-2.5 text-[15px] text-muted">…</div>
              </li>
            )}
          </ul>
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      <form onSubmit={send} className="mt-3 flex items-end gap-2">
        <button
          type="button"
          onClick={speech.listening ? speech.stop : speech.start}
          disabled={!speech.supported}
          aria-pressed={speech.listening}
          aria-label={speech.listening ? 'Stop recording' : 'Speak your message'}
          className={`btn shrink-0 px-3 py-3 ${
            speech.listening ? 'bg-tier-high text-white' : 'btn-quiet'
          }`}
        >
          {speech.listening ? <Square size={18} /> : <Mic size={18} />}
        </button>

        <textarea
          rows={1}
          value={draft}
          maxLength={MAX_CHAT}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) send(e);
          }}
          placeholder="Type your question…"
          aria-label="Your message"
          className="field resize-none py-3"
        />

        <button type="submit" className="btn-primary shrink-0 px-3 py-3" disabled={!draft.trim() || busy}>
          <Send size={18} aria-hidden="true" />
          <span className="sr-only">Send</span>
        </button>
      </form>
    </div>
  );
}

/* --------------------------------------------------------------- page --- */

export default function Home() {
  const { user, loading } = useAuth();
  const [mode, setMode] = useState('symptoms');

  return (
    <div>
      <div className="mb-8 max-w-reading">
        <h1 className="text-3xl leading-tight sm:text-4xl">
          Tell us what is wrong, before you sit with the doctor.
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          Speak or type in Hindi or English. Sudha Setu checks what you describe against advice
          approved by Ayush doctors, and passes a ready case sheet to the physician.
        </p>
      </div>

      {loading ? null : !user ? (
        <div className="panel p-6">
          <h2 className="text-lg">Sign in to describe your symptoms</h2>
          <p className="mt-2 max-w-reading text-[15px] text-muted">
            Your case sheet is part of your medical record, so it is kept behind your account.
            Conditions and remedies are open to browse without signing in.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/signin" className="btn-primary">
              Sign in
            </Link>
            <Link to="/register" className="btn-quiet">
              Create an account
            </Link>
            <Link to="/diseases" className="btn-ghost">
              Browse conditions
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div
            role="tablist"
            aria-label="How would you like to start?"
            className="mb-6 inline-flex rounded-lg bg-sage p-1"
          >
            {[
              ['symptoms', 'Describe symptoms'],
              ['chat', 'Ask the assistant'],
            ].map(([value, label]) => (
              <button
                key={value}
                role="tab"
                type="button"
                aria-selected={mode === value}
                onClick={() => setMode(value)}
                className={`rounded-md px-4 py-2 text-sm transition-colors ${
                  mode === value ? 'bg-white font-medium text-ink shadow-sm' : 'text-muted hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === 'symptoms' ? <IntakePanel user={user} /> : <ChatPanel user={user} />}
        </>
      )}
    </div>
  );
}
