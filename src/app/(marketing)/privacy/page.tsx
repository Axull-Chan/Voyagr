import type { Metadata } from "next"

import {
  LegalLink,
  LegalPage,
  LegalSection,
  PROJECT_ISSUES_URL,
} from "@/features/marketing/components/legal-page"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What Voyagr stores about you, which outside services see your trip details, and how to have your data removed.",
}

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      summary="Voyagr is a portfolio project, not a company. This page says plainly what the app stores, who else sees it, and how to get it removed."
      updated="18 November 2026"
    >
      <LegalSection id="who" heading="Who runs this">
        <p>
          Voyagr is a demo travel planner built and run by one person as a
          portfolio project. There is no company, no staff and no support
          team behind it. The source code is public at{" "}
          <LegalLink href="https://github.com/Axull-Chan/Voyagr">
            github.com/Axull-Chan/Voyagr
          </LegalLink>
          , so anything on this page can be checked against what the app
          actually does.
        </p>
        <p>
          The way to reach the owner is the project&rsquo;s{" "}
          <LegalLink href={PROJECT_ISSUES_URL}>GitHub issues</LegalLink>.
          Issues are public, so never post a password, your trip details or
          anything else private there.
        </p>
      </LegalSection>

      <LegalSection id="collect" heading="What the app stores">
        <p>Only what you give it, plus a little bookkeeping:</p>
        <ul>
          <li>
            <strong>Your account.</strong> Your email address and the name
            you enter when you sign up, and your preferred currency. With
            email and password, the password is stored as a hash by Supabase
            Auth; the app never sees or stores the plain text. With Google
            sign-in, Google shares your email and the name and picture on
            your Google profile.
          </li>
          <li>
            <strong>Your trips.</strong> Everything you type into the trip
            wizard (destination, starting city, dates, number of travellers,
            budget and currency, travel style, interests, accommodation and
            transport preferences, free-text notes) and everything generated
            from it: the days, activities, restaurants, stay, transport,
            weather and budget breakdown.
          </li>
          <li>
            <strong>What you add afterwards.</strong> Expenses you log,
            packing-list items and whether they are ticked, trip notes,
            favourites, and your conversation with the trip assistant,
            including the edits it proposed and whether you applied them.
          </li>
          <li>
            <strong>Usage counters.</strong> Each trip generation and each
            assistant message is recorded with your account id and a
            timestamp so the daily limits can be enforced. Those rows are
            cleared out once they are about two days old.
          </li>
          <li>
            <strong>Error reports.</strong> When something breaks, the app
            may record the page or route, the error message and stack trace,
            the app version and your browser&rsquo;s user-agent string.
            Reports sent by the server carry no user id. Reports sent from
            your browser while you are signed in are linked to your account
            id. Messages are written by the code that failed, so they can
            occasionally contain a fragment of what you were doing. Each
            kind of error is stored once with a counter, and old ones are
            purged after about 30 days.
          </li>
        </ul>
        <p>
          Your name and email are not sent to any of the outside services
          listed below.
        </p>
      </LegalSection>

      <LegalSection id="cookies" heading="Cookies and local storage">
        <ul>
          <li>
            <strong>Sign-in cookies.</strong> Supabase Auth keeps you signed
            in with session cookies. They are strictly necessary: without
            them you cannot log in. They are set when you sign in and
            removed when you sign out.
          </li>
          <li>
            <strong>Interface preferences.</strong> A <code>sidebar_state</code>{" "}
            cookie remembers whether the dashboard sidebar is open, and your
            browser&rsquo;s local storage holds your light or dark theme
            choice and an unfinished trip-wizard draft so a reload does not
            lose it. None of these identify you and none leave your browser
            except the sidebar cookie, which is sent back to this site.
          </li>
        </ul>
        <p>
          There are no advertising cookies, no analytics scripts and no
          tracking pixels in the app&rsquo;s code. Because there is nothing
          optional to consent to, there is no cookie banner. The
          hosting provider, Vercel, still handles ordinary request logs
          (such as IP address and the page requested) as part of serving the
          site.
        </p>
      </LegalSection>

      <LegalSection id="third-parties" heading="Who else sees your data">
        <p>
          Making an itinerary means sending parts of your trip to outside
          services. Requests to them are made by the app&rsquo;s server, so
          they see the server&rsquo;s address rather than yours, with the
          one exception of map tiles noted below.
        </p>
        <ul>
          <li>
            <strong>Supabase</strong> hosts the database and sign-in. The
            project&rsquo;s database is in Singapore.
          </li>
          <li>
            <strong>Vercel</strong> hosts the website and runs its server
            code.
          </li>
          <li>
            <strong>Google Gemini</strong> writes the itinerary and the
            assistant&rsquo;s replies. It receives the trip details you
            entered, including your free-text notes, a list of real places
            found nearby and the forecast. For the assistant it also
            receives your message, your recent messages and the current
            itinerary text. The app uses Google&rsquo;s free tier, and
            Google&rsquo;s terms for free use may allow it to keep and use
            submitted content to improve its products, so do not put
            anything sensitive in notes or in chat. Check Google&rsquo;s
            current terms for the details.
          </li>
          <li>
            <strong>Nominatim (OpenStreetMap)</strong> turns your
            destination text into coordinates.
          </li>
          <li>
            <strong>Open-Meteo</strong> (forecast) and{" "}
            <strong>OpenTripMap</strong> (attractions, restaurants, places to
            stay) receive coordinates and dates, not your identity.
          </li>
          <li>
            <strong>Frankfurter</strong> supplies exchange rates and receives
            only currency codes.
          </li>
          <li>
            <strong>Unsplash</strong> supplies the destination photo and
            receives the destination as a search term. The photo is shown
            with a credit to its photographer.
          </li>
          <li>
            <strong>OpenFreeMap</strong> supplies the map tiles. Your browser
            loads them directly, so OpenFreeMap sees your IP address and the
            part of the map you are viewing.
          </li>
          <li>
            <strong>Google</strong>, only if you choose &ldquo;Continue with
            Google&rdquo; to sign in.
          </li>
        </ul>
        <p>
          Each of these services has its own privacy policy and the app has
          no control over how they handle what they receive. Nothing is sold
          or shared for advertising.
        </p>
      </LegalSection>

      <LegalSection id="security" heading="How it is protected">
        <p>
          Traffic to the site uses HTTPS. In the database, every table that
          holds your data has Row Level Security, so the app can only read or
          change rows that belong to your account. That is a real safeguard
          but not a guarantee: the person running the project has
          administrative access to the database and could in principle read
          what is stored, and the data is not end-to-end encrypted. Treat
          this as a demo, and do not store anything here you would not be
          comfortable having in a hobby project.
        </p>
      </LegalSection>

      <LegalSection id="deleting" heading="Keeping and deleting your data">
        <p>
          Your data stays until you remove it. You can delete individual
          trips from the app, which removes that trip and everything attached
          to it (its itinerary, expenses, packing list and chat). You can
          also download a trip as a file from the trip menu.
        </p>
        <p>
          There is no self-service button yet to delete a whole account. To
          have your account and everything linked to it removed, open an
          issue on the project&rsquo;s{" "}
          <LegalLink href={PROJECT_ISSUES_URL}>GitHub repository</LegalLink>{" "}
          asking for deletion, without posting private details; the owner
          will say there how to confirm the account is yours. Removing an
          account removes its profile, trips and everything stored under
          them. Copies already sent to the services above, and any backups
          Supabase keeps, are outside the app&rsquo;s control.
        </p>
      </LegalSection>

      <LegalSection id="children" heading="Children">
        <p>
          Voyagr is not aimed at children and does not knowingly collect
          information from them.
        </p>
      </LegalSection>

      <LegalSection id="law" heading="What this page is not">
        <p>
          This is an honest description of the app, not a legal opinion. It
          does not claim compliance with any particular privacy law or
          standard. If the way this project is used changes, this page will
          be updated and the date at the top will change.
        </p>
        <p>
          See also the <LegalLink href="/terms">Terms of Use</LegalLink>.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
