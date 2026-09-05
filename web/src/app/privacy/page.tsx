export const metadata = { title: "Privacy Policy · Brown Course Constellations" };

export default function Privacy() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0b1c",
        color: "#c9d2ea",
        fontFamily: "system-ui",
        padding: "60px 24px",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto", lineHeight: 1.7, fontSize: 15 }}>
        <h1 style={{ fontSize: 24, color: "#e8ecf5" }}>Privacy Policy</h1>
        <p style={{ color: "#7b8494" }}>Last updated: September 5, 2026</p>

        <p>
          Brown Course Constellations (&quot;the site&quot;) is an unofficial student project that
          visualizes Brown University course and concentration data. This policy describes what
          we collect and how it is used.
        </p>

        <h2 style={h2}>What we collect</h2>
        <ul>
          <li>
            <b>Google sign-in (optional):</b> if you sign in with your Brown Google account, we
            receive your email address and name from Google. Sign-in is restricted to
            @brown.edu accounts. We do not receive your password, and we request no other
            Google data or scopes.
          </li>
          <li>
            <b>Your course plan:</b> courses you mark as taken or planned are stored in our
            database, associated with your email, so they sync across devices.
          </li>
          <li>
            <b>Guests:</b> without signing in, your course selections are stored only in your
            browser (localStorage) and never sent to us.
          </li>
        </ul>

        <h2 style={h2}>What we don&apos;t do</h2>
        <ul>
          <li>No advertising, no analytics trackers, no sale or sharing of data with third parties.</li>
          <li>No access to your Brown academic record. Courses you mark are self-reported.</li>
        </ul>

        <h2 style={h2}>Where data lives</h2>
        <p>
          Account and plan data is stored in a Neon (PostgreSQL) database and processed by
          Vercel hosting infrastructure. Authentication uses Auth.js session cookies, which are
          required for sign-in to function.
        </p>

        <h2 style={h2}>Deleting your data</h2>
        <p>
          Email <a href="mailto:david_cui@brown.edu" style={{ color: "#8fb4e8" }}>david_cui@brown.edu</a>{" "}
          from your account address and we will delete your account and plan data.
        </p>

        <h2 style={h2}>Course data sources</h2>
        <p>
          Course and concentration information is compiled from the public Brown University
          Bulletin and Courses@Brown. This site is not affiliated with or endorsed by Brown
          University.
        </p>

        <p style={{ marginTop: 40 }}>
          <a href="/" style={{ color: "#8fb4e8" }}>← back to the galaxy</a>
        </p>
      </div>
    </div>
  );
}

const h2: React.CSSProperties = { fontSize: 17, color: "#e8ecf5", marginTop: 28 };
