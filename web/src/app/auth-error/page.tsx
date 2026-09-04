export default function AuthError({ searchParams }: { searchParams: { error?: string } }) {
  const accessDenied = searchParams.error === "AccessDenied";
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#0a0b1c",
        color: "#d5dbe3",
        fontFamily: "system-ui",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <h1 style={{ fontSize: 20 }}>{accessDenied ? "Brown accounts only" : "Sign-in error"}</h1>
        <p style={{ color: "#8a93a3" }}>
          {accessDenied
            ? "This site uses your Brown Google account (@brown.edu). Please sign in with that account."
            : "Something went wrong during sign-in. Please try again."}
        </p>
        <a href="/" style={{ color: "#8fb4e8" }}>← back to the map</a>
      </div>
    </div>
  );
}
