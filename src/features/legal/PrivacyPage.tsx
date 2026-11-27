import { LegalLayout } from './LegalLayout';

const CONTACT = 'WhatsApp +92 348 9026184';

export function PrivacyPage() {
  return (
    <LegalLayout title="Privacy policy" updated="27 November 2026">
      <section>
        <h2 className="text-xl text-white">Who we are</h2>
        <p className="mt-2">
          Pathray helps students find funded ways to study abroad. This page explains what
          information we collect, why, and how you can have it deleted. To ask us anything about
          your data, contact us on {CONTACT}.
        </p>
      </section>

      <section>
        <h2 className="text-xl text-white">What we collect</h2>
        <ul className="mt-2 list-disc pl-5">
          <li>Your name, email address and WhatsApp number from the Quick Check.</li>
          <li>Your Quick Check answers: study level, field, results, English test, budget, scholarship need and preferred countries.</li>
          <li>If you order a report: your order, the payment method you used, an optional transaction ID, and the receipt file you upload.</li>
          <li>The profile form you fill in after your payment is confirmed.</li>
          <li>If you sign in with Google: the name and email address Google shares with us. We never see your Google password.</li>
        </ul>
        <p className="mt-2">
          When you start the Quick Check, we create a temporary account for you. If you save your
          result, it becomes a permanent account.
        </p>
      </section>

      <section>
        <h2 className="text-xl text-white">Why we use it</h2>
        <ul className="mt-2 list-disc pl-5">
          <li>To show your Quick Check result and save it to your account.</li>
          <li>To research and deliver your report, and to check your payment.</li>
          <li>To contact you on WhatsApp or email about your result and any report you order.</li>
          <li>To send study tips and updates only if you ticked that optional box. You can ask us to stop at any time.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl text-white">Who can see it</h2>
        <p className="mt-2">
          You, and the Pathray team member who works on your case. We do not sell your data, and
          we do not share it for advertising. We use Supabase to store data and to sign you in, and
          Google if you choose to sign in with Google.
        </p>
      </section>

      <section>
        <h2 className="text-xl text-white">How long we keep it</h2>
        <p className="mt-2">
          We keep your data until you ask us to delete it. We keep a record of any order you placed
          (reference, amount, dates and status) for our accounts, even after deletion.
        </p>
      </section>

      <section>
        <h2 className="text-xl text-white">Deleting your data</h2>
        <p className="mt-2">
          Sign in and use <strong>Delete my data</strong> on your home page. It erases your name,
          phone, email, Quick Check answers, profile form, report and receipt files. The order
          record described above stays, with none of your personal details attached. Your sign-in
          address stays in our login system, unlinked from your name. Message us on {CONTACT} if
          you want that removed too.
        </p>
      </section>

      <section>
        <h2 className="text-xl text-white">Payments</h2>
        <p className="mt-2">
          You pay by bank transfer, JazzCash or Easypaisa, outside this website. We never ask for
          card numbers or passwords on this site. We only see the receipt you choose to upload.
        </p>
      </section>

      <section>
        <h2 className="text-xl text-white">Changes</h2>
        <p className="mt-2">
          If we change this policy, we update the date at the top of this page.
        </p>
      </section>
    </LegalLayout>
  );
}

export default PrivacyPage;