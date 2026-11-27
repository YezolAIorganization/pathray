import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type VerifiedPathway = {
  id: string;
  title: string;
  university_or_program: string;
  funding_type: string;
  deadline: string;
  source_url: string;
  checked_on?: string;
  fact_verified: boolean;
  notes: string;
};

type PublishedReport = {
  id: string;
  summary: string | null;
  content: VerifiedPathway[];
  updated_at: string;
};

type ReportViewerProps = {
  journeyId: string;
};

function isSafeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

// Shows a YYYY-MM-DD check date as a plain calendar date (no time zone shift).
function formatCheckDate(value?: string): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function ReportViewer({ journeyId }: ReportViewerProps) {
  const [report, setReport] = useState<PublishedReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function fetchReport() {
      setLoading(true);
      const { data, error } = await supabase
        .from('reports')
        .select('id, summary, content, updated_at')
        .eq('journey_id', journeyId)
        .eq('is_published', true)
        .maybeSingle();

      if (!active) return;

      if (error) {
        console.error('Failed to load published report:', error);
      } else if (data) {
        setReport({
          id: data.id,
          summary: data.summary,
          content: Array.isArray(data.content) ? (data.content as VerifiedPathway[]) : [],
          updated_at: data.updated_at,
        });
      }
      setLoading(false);
    }

    void fetchReport();
    return () => {
      active = false;
    };
  }, [journeyId]);

  if (loading) {
    return (
      <div className="mt-6 rounded-card border border-white/12 bg-[rgb(19_31_63/0.92)] p-5">
        <p className="text-sm text-white/70">Loading your funding assessment report...</p>
      </div>
    );
  }

  if (!report) {
    return null;
  }

  return (
    <section className="mt-6 rounded-card border border-white/15 bg-[rgb(19_31_63/0.92)] p-6 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/12 pb-4">
        <div>
          <span className="inline-block rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white">
            Verified funding assessment
          </span>
          <h2 className="mt-2 font-heading text-2xl text-white">Your personalized roadmap</h2>
        </div>
        <div className="text-xs text-white/60">
          Last updated: {new Date(report.updated_at).toLocaleDateString()}
        </div>
      </div>

      {report.summary && (
        <div className="mt-4 rounded-control border border-white/10 bg-white/5 p-4">
          <h3 className="text-sm font-medium text-white">Executive summary</h3>
          <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-white/90">
            {report.summary}
          </p>
        </div>
      )}

      <div className="mt-6 grid gap-4">
        <h3 className="text-lg font-medium text-white">
          Recommended funding pathways ({report.content.length})
        </h3>

        {report.content.map((item, idx) => {
          const checkedOn = formatCheckDate(item.checked_on);

          return (
            <article
              key={item.id}
              className="rounded-control border border-white/15 bg-white/5 p-5 transition-colors hover:border-white/30"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-medium text-white/70">Pathway #{idx + 1}</div>
                  <h4 className="mt-0.5 text-lg font-medium text-white">{item.title}</h4>
                  <p className="text-sm text-white/75">{item.university_or_program}</p>
                </div>
                {item.fact_verified && (
                  <span className="rounded-full border border-green-500/30 bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-300">
                    Fact verified
                  </span>
                )}
              </div>

              <div className="mt-4 grid gap-2 border-y border-white/10 py-3 text-sm sm:grid-cols-2">
                <div>
                  <span className="text-white/60">Coverage: </span>
                  <span className="font-medium text-white">{item.funding_type}</span>
                </div>
                <div>
                  <span className="text-white/60">Deadline: </span>
                  <span className="font-medium text-white">{item.deadline || 'Rolling / see link'}</span>
                </div>
                {checkedOn && (
                  <div className="sm:col-span-2">
                    <span className="text-white/60">Source checked on: </span>
                    <span className="font-medium text-white">{checkedOn}</span>
                  </div>
                )}
              </div>

              {item.notes && (
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-white/85">
                  {item.notes}
                </p>
              )}

              {item.source_url && isSafeUrl(item.source_url) && (
                <div className="mt-4">
                  <a
                    href={item.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center rounded-control bg-white px-4 text-sm font-medium text-navy no-underline transition-colors hover:bg-white/90"
                  >
                    Open official application source &rarr;
                  </a>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}