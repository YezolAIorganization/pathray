import { LegalLayout } from './LegalLayout';

const CONTACT = 'WhatsApp +92 348 9026184';

export function TermsPage() {
  return (
    <LegalLayout title="Terms" updated="27 November 2026">
      <section>
        <h2 className="text-xl text-white">What Pathray is</h2>
        <p className="mt-2">
          Pathray helps students plan how to study abroad. We offer a free Quick Check, a paid
          Pathray Report (funding-first research on study options, with a source link and check
          date for every fact) and other paid services listed on our website. By using this
          website you agree to these terms.
        </p>
      </section>

      <section>
        <h2 className="text-xl text-white">Our services</h2>
        <p className="mt-2">
          Each paid service is described on our website, with what it includes and its price,
          before you order. A service is only available to order when it is shown as available.
          These terms apply to every service we offer.
        </p>
      </section>

      <section>
        <h2 className="text-xl text-white">No guarantees</h2>
        <p className="mt-2">
          The Quick Check is an estimate from your answers, not a prediction. We do not guarantee
          admission, a scholarship, funding or a visa. Universities, funders and governments make
          those decisions, and their rules and deadlines can change. Check the official source
          before you apply.
        </p>
      </section>

      <section>
        <h2 className="text-xl text-white">What we do not do</h2>
        <p className="mt-2">
          We do not file visa applications, write applications for you, handle tuition payments or
          sell flights, currency exchange or SIM cards. We take no commission from universities or
          funders, and we do not sell placements.
        </p>
      </section>

      <section>
        <h2 className="text-xl text-white">The report and the 48-hour timeline</h2>
        <p className="mt-2">
          After your payment is confirmed and your profile is complete, we aim to deliver your
          report within 48 hours. This is a target, not a promise, and delays can happen. We tell
          you on your home page where your order stands.
        </p>
      </section>

      <section>
        <h2 className="text-xl text-white">Payment</h2>
        <p className="mt-2">
          The price is shown before you order. You pay by bank transfer, JazzCash or Easypaisa,
          outside this website, and upload your receipt. We confirm payments by hand. Keep your
          order reference. If we cannot confirm your payment, we will tell you and you can send it
          again.
        </p>
      </section>

      <section>
        <h2 className="text-xl text-white">Refunds</h2>
        <p className="mt-2">
          If we cannot deliver your report or service, we will refund your payment. Once a report
          or service has been delivered, it cannot be refunded because the work has been done. To
          ask about a refund, contact us on {CONTACT} with your order reference.
        </p>
      </section>

      <section>
        <h2 className="text-xl text-white">Your part</h2>
        <p className="mt-2">
          Give us true and complete information. Do not upload files that are not yours or that
          you have no right to share. Keep your report for your own use and do not resell it.
        </p>
      </section>

      <section>
        <h2 className="text-xl text-white">Your data</h2>
        <p className="mt-2">
          How we handle your data, and how to delete it, is described in our privacy policy.
        </p>
      </section>

      <section>
        <h2 className="text-xl text-white">Contact and changes</h2>
        <p className="mt-2">
          Questions about these terms: {CONTACT}. If we change the terms, we update the date at the
          top of this page.
        </p>
      </section>
    </LegalLayout>
  );
}

export default TermsPage;