import type { Metadata } from "next"

import {
  LegalLink,
  LegalPage,
  LegalSection,
  PROJECT_ISSUES_URL,
} from "@/features/marketing/components/legal-page"

export const metadata: Metadata = {
  title: "Terms of Use",
  description:
    "The ground rules for using Voyagr, a portfolio project: AI itineraries can be wrong, third-party data is provided as is, and there is no warranty.",
}

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Use"
      summary="Short and plain. Voyagr is a demonstration project, and using it means accepting that it comes as it is."
      updated="18 November 2026"
    >
      <LegalSection id="what" heading="What Voyagr is">
        <p>
          Voyagr is a portfolio project that shows what an AI travel planner
          can do: you describe a trip, it drafts an itinerary, a budget and
          a packing list, and you can edit them. It is a demonstration
          built by one person, not a commercial service. It may change,
          break or disappear at any time. Voyagr is free: the paid plans on
          the landing page are marked as coming soon, the app has no payment
          system, and nothing is ever charged.
        </p>
      </LegalSection>

      <LegalSection id="check" heading="Check everything before you travel">
        <p>
          Itineraries and chat suggestions are written by an AI model and can
          be wrong. Opening hours, prices, travel times and distances are
          estimates. A place can have closed, moved or never been what the
          description says. Weather is a forecast or a typical-weather
          figure, not a promise, and any hotel marked as an example is a
          placeholder for budgeting, not a real listing.
        </p>
        <p>
          Before you book or travel, confirm every detail that matters
          (visas, entry rules, health requirements, safety advice, bookings,
          opening times and costs) with official or first-hand sources. You
          are responsible for your own travel decisions.
        </p>
      </LegalSection>

      <LegalSection id="third-party" heading="Third-party data">
        <p>
          Places, weather, exchange rates, maps and photos come from outside
          providers such as OpenTripMap, OpenStreetMap, Open-Meteo,
          Frankfurter, OpenFreeMap and Unsplash. That data is provided as
          is. It can be incomplete, out of date or wrong, and those
          providers set their own terms for their data. Photos belong to
          their photographers and are shown with credit.
        </p>
      </LegalSection>

      <LegalSection id="account" heading="Your account and your content">
        <ul>
          <li>
            Keep your password to yourself and give accurate details when you
            sign up. You are responsible for what happens under your account.
          </li>
          <li>
            What you put in is yours. By using the app you let it store and
            process that content, including sending the relevant parts to the
            services described in the{" "}
            <LegalLink href="/privacy">Privacy Policy</LegalLink>, in order to
            run the features you asked for.
          </li>
          <li>
            Do not put anything sensitive or confidential in trip notes or
            chat, and do not enter other people&rsquo;s personal details.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="use" heading="Fair use">
        <p>Please do not:</p>
        <ul>
          <li>break the law, or use the app to harm or harass anyone;</li>
          <li>
            try to get around the daily limits on trip generation and chat,
            probe the site for weaknesses, or overload it with automated
            requests;
          </li>
          <li>
            use the app to make the AI produce abusive, illegal or deceptive
            content, or to attack the services it relies on.
          </li>
        </ul>
        <p>
          The limits exist because the AI quota is shared and free. They can
          change, and an account that abuses the app may be limited or
          removed.
        </p>
      </LegalSection>

      <LegalSection id="warranty" heading="No warranty, limited liability">
        <p>
          Voyagr is provided &ldquo;as is&rdquo; and &ldquo;as
          available&rdquo;, without warranties of any kind, whether express
          or implied, including that it is accurate, reliable, uninterrupted
          or fit for any particular purpose. To the fullest extent the law
          allows, the owner is not liable for any loss or damage arising from
          using the app or relying on what it produces, including missed
          bookings, wasted trips, extra costs or lost data. Nothing here
          limits any right you have that cannot lawfully be limited.
        </p>
        <p>
          Data can be lost. Keep your own copy of anything important; you can
          download a trip as a file from the trip menu.
        </p>
      </LegalSection>

      <LegalSection id="ending" heading="Ending things">
        <p>
          You can stop using Voyagr whenever you like and delete your trips
          from within the app. To have your whole account removed, see the
          deletion section of the{" "}
          <LegalLink href="/privacy#deleting">Privacy Policy</LegalLink>. The
          owner may change or shut down the app, or remove accounts, at any
          time, and will try to give notice where that is practical, but is
          not obliged to.
        </p>
      </LegalSection>

      <LegalSection id="changes" heading="Changes and contact">
        <p>
          These terms may be updated; the date at the top shows the latest
          version, and continuing to use the app after a change means you
          accept it. Questions go to the project&rsquo;s{" "}
          <LegalLink href={PROJECT_ISSUES_URL}>GitHub issues</LegalLink>{" "}
          (public, so keep private details out of them).
        </p>
        <p>
          These terms are a plain-language description for a hobby project,
          not legal advice, and make no claim to satisfy any particular
          jurisdiction&rsquo;s requirements.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
