import { useState } from 'react';
import { supabase } from '../../lib/supabase';

type Props = {
  journeyId: string;
  onSubmitted: () => void;
};

const DEGREE_OPTIONS = [
  "Bachelor's",
  "Master's",
  'PhD / Doctorate',
  'Other',
];

const FIELD_OPTIONS = [
  'Computer Science & IT',
  'Engineering',
  'Business & Finance',
  'Data Science & AI',
  'Health & Life Sciences',
  'Social Sciences & Humanities',
  'Arts & Design',
  'Other',
];

const GPA_BAND_OPTIONS = [
  '3.7+ / 4.0 or 85%+ / First Class',
  '3.3 – 3.69 / 4.0 or 75% – 84%',
  '2.8 – 3.29 / 4.0 or 65% – 74%',
  'Below 2.8 / 4.0 or below 65%',
  'Prefer to enter exact score',
];

const ENGLISH_OPTIONS = [
  'IELTS completed',
  'IELTS booked / planned',
  'TOEFL / PTE completed or planned',
  'Medium of instruction letter available',
  'Not started yet',
];

const BUDGET_BAND_OPTIONS = [
  'Band 0 — Lowest budget (needs major funding)',
  'Band 1 — Modest budget',
  'Band 2 — Moderate budget',
  'Band 3 — Flexible / higher budget',
];

export function ProfileWizard({ journeyId, onSubmitted }: Props) {
  const [step, setStep] = useState(1);

  const [degreeChoice, setDegreeChoice] = useState('');
  const [customDegree, setCustomDegree] = useState('');

  const [fieldChoice, setFieldChoice] = useState('');
  const [customField, setCustomField] = useState('');

  const [gpaChoice, setGpaChoice] = useState('');
  const [customGpa, setCustomGpa] = useState('');

  const [englishStatus, setEnglishStatus] = useState('');
  const [budgetBand, setBudgetBand] = useState('');
  const [notes, setNotes] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedDegree = degreeChoice === 'Other' ? customDegree.trim() : degreeChoice;
  const resolvedField = fieldChoice === 'Other' ? customField.trim() : fieldChoice;
  const resolvedGpa =
    gpaChoice === 'Prefer to enter exact score' ? customGpa.trim() : gpaChoice;

  async function handleFinish(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);

    if (!resolvedDegree || !resolvedField) {
      setError('Please complete your degree level and field of study first.');
      return;
    }

    setBusy(true);

    const { error: rpcError } = await supabase.rpc('submit_profile', {
      p_journey_id: journeyId,
      p_details: {
        degree_level: resolvedDegree,
        field_of_study: resolvedField,
        gpa: resolvedGpa,
        english_status: englishStatus,
        budget_band: budgetBand,
        notes: notes.trim(),
      },
    });

    if (rpcError) {
      console.error('submit_profile failed:', rpcError);
      setError('We could not save your profile. Please try again.');
      setBusy(false);
      return;
    }

    setBusy(false);
    onSubmitted();
  }

  return (
    <div className="rounded-card border border-white/12 bg-[rgb(19_31_63/0.92)] p-5 sm:p-8">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl">Complete your profile</h2>
        <span className="text-sm text-white/70">Step {step} of 3</span>
      </div>

      <form
        onSubmit={
          step === 3
            ? handleFinish
            : (e) => {
                e.preventDefault();
                setError(null);
                setStep((s) => s + 1);
              }
        }
        className="mt-5"
      >
        {step === 1 && (
          <div className="grid gap-4">
            <div>
              <label htmlFor="profile-degree" className="block text-sm font-medium text-white/80">
                Degree level you want
              </label>
              <select
                id="profile-degree"
                value={degreeChoice}
                onChange={(e) => setDegreeChoice(e.target.value)}
                className="mt-2 block min-h-11 w-full rounded-control border border-white/15 bg-midnight px-4 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-bright"
                required
              >
                <option value="">Select degree level</option>
                {DEGREE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>

              {degreeChoice === 'Other' && (
                <input
                  type="text"
                  value={customDegree}
                  onChange={(e) => setCustomDegree(e.target.value)}
                  placeholder="Enter your target degree level"
                  aria-label="Custom degree level"
                  className="mt-2 block min-h-11 w-full rounded-control border border-white/15 bg-white/5 px-4 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-bright"
                  required
                />
              )}
            </div>

            <div>
              <label htmlFor="profile-field" className="block text-sm font-medium text-white/80">
                Field of study
              </label>
              <select
                id="profile-field"
                value={fieldChoice}
                onChange={(e) => setFieldChoice(e.target.value)}
                className="mt-2 block min-h-11 w-full rounded-control border border-white/15 bg-midnight px-4 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-bright"
                required
              >
                <option value="">Select field of study</option>
                {FIELD_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>

              {fieldChoice === 'Other' && (
                <input
                  type="text"
                  value={customField}
                  onChange={(e) => setCustomField(e.target.value)}
                  placeholder="Enter your field of study"
                  aria-label="Custom field of study"
                  className="mt-2 block min-h-11 w-full rounded-control border border-white/15 bg-white/5 px-4 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-bright"
                  required
                />
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-4">
            <div>
              <label htmlFor="profile-gpa" className="block text-sm font-medium text-white/80">
                Academic score / GPA
              </label>
              <select
                id="profile-gpa"
                value={gpaChoice}
                onChange={(e) => setGpaChoice(e.target.value)}
                className="mt-2 block min-h-11 w-full rounded-control border border-white/15 bg-midnight px-4 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-bright"
              >
                <option value="">Select academic standing</option>
                {GPA_BAND_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>

              {gpaChoice === 'Prefer to enter exact score' && (
                <input
                  type="text"
                  value={customGpa}
                  onChange={(e) => setCustomGpa(e.target.value)}
                  placeholder="e.g. 3.45 / 4.0 or 78%"
                  aria-label="Exact academic score or GPA"
                  className="mt-2 block min-h-11 w-full rounded-control border border-white/15 bg-white/5 px-4 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-bright"
                />
              )}
            </div>

            <div>
              <label htmlFor="profile-english" className="block text-sm font-medium text-white/80">
                English test status
              </label>
              <select
                id="profile-english"
                value={englishStatus}
                onChange={(e) => setEnglishStatus(e.target.value)}
                className="mt-2 block min-h-11 w-full rounded-control border border-white/15 bg-midnight px-4 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-bright"
              >
                <option value="">Select English test status</option>
                {ENGLISH_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-4">
            <div>
              <label htmlFor="profile-budget" className="block text-sm font-medium text-white/80">
                Yearly budget band
              </label>
              <select
                id="profile-budget"
                value={budgetBand}
                onChange={(e) => setBudgetBand(e.target.value)}
                className="mt-2 block min-h-11 w-full rounded-control border border-white/15 bg-midnight px-4 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-bright"
              >
                <option value="">Select yearly budget band</option>
                {BUDGET_BAND_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="profile-notes" className="block text-sm font-medium text-white/80">
                What else do you need help with?
              </label>
              <textarea
                id="profile-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Share any deadlines, visa/refusal history, or specific questions."
                className="mt-2 block w-full rounded-control border border-white/15 bg-white/5 p-4 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-bright"
              />
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 text-sm font-medium text-red-400">
            {error}
          </p>
        )}

        <div className="mt-6 flex gap-3">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="inline-flex min-h-11 items-center justify-center rounded-control border border-white/25 px-5 font-medium text-white"
            >
              Back
            </button>
          )}
          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-control bg-white px-5 font-medium text-navy disabled:opacity-50"
          >
            {busy ? 'Saving...' : step === 3 ? 'Submit profile' : 'Next step'}
          </button>
        </div>
      </form>
    </div>
  );
}