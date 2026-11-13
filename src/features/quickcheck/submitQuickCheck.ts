import { supabase, ensureAnonymousSession } from '../../lib/supabase';
import type { Contact } from './ContactStep';

type Answers = Record<string, string | string[]>;

// The tier is worked out again on the server, so the browser's tier is not sent.
export async function submitQuickCheck(
  answers: Answers,
  _tier: string | null,
  contact: Contact,
): Promise<string> {
  await ensureAnonymousSession();

  const { data, error } = await supabase.rpc('submit_quick_check', {
    p_market: typeof answers.market === 'string' ? answers.market : '',
    p_answers: answers,
    p_name: contact.name,
    p_email: contact.email,
    p_whatsapp: contact.whatsapp,
    p_consent: contact.consent,
    p_marketing: contact.marketing,
  });

  if (error) {
    throw new Error(error.message || 'Could not save your answers. Please try again.');
  }

  const result = data as { journey_id?: string } | null;
  if (!result?.journey_id) {
    throw new Error('Could not save your answers. Please try again.');
  }

  return result.journey_id;
}