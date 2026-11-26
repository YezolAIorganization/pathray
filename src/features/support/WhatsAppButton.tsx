import { useLocation } from 'react-router-dom';

const WHATSAPP_NUMBER = '923489026184';
const WHATSAPP_MESSAGE = 'Hi Pathray, I need help with my Quick Check.';

const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

export function WhatsAppButton() {
  const { pathname } = useLocation();

  // The admin page is for staff, so students' help button is hidden there.
  if (pathname.startsWith('/admin')) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="fixed bottom-4 right-4 z-50 inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-5 font-medium text-navy shadow-lg transition-transform duration-150 ease-pathray active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-bright"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-5 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.7-5.3A8.5 8.5 0 1 1 21 11.5Z" />
      </svg>
      Need help? Chat with us
    </a>
  );
}