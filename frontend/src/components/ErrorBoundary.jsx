// src/components/ErrorBoundary.jsx
import React from "react";

// Why this exists: React unmounts the entire tree when a component throws during
// render or inside an effect, and there was no boundary anywhere in this app. The
// result was a completely blank white page - no header, no footer, no clue what
// went wrong. This turns that into a readable message plus a way out.
//
// Colours follow the CS dark theme tokens from index.css.
const panelStyle = {
  maxWidth: "860px",
  margin: "40px auto",
  padding: "24px 28px",
  fontFamily: "Inter, system-ui, sans-serif",
  color: "var(--cs-text)",
  background: "var(--cs-panel)",
  border: "1px solid var(--cs-danger)",
  borderRadius: "12px",
  boxShadow: "var(--cs-shadow)",
};

const headingStyle = { fontSize: "22px", marginBottom: "8px", color: "#f87171" };

const introStyle = { marginBottom: "16px", fontSize: "14px", lineHeight: 1.5 };

const labelStyle = { margin: "0 0 4px", fontSize: "13px", fontWeight: 600 };

const messageStyle = {
  margin: "0 0 16px",
  padding: "12px",
  background: "rgba(239, 68, 68, 0.12)",
  border: "1px solid rgba(239, 68, 68, 0.35)",
  borderRadius: "8px",
  fontSize: "13px",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

const codeStyle = {
  margin: "0 0 16px",
  padding: "12px",
  background: "var(--cs-panel-2)",
  border: "1px solid var(--cs-border)",
  borderRadius: "8px",
  fontSize: "12px",
  maxHeight: "220px",
  overflow: "auto",
  whiteSpace: "pre-wrap",
};

const primaryButtonStyle = {
  padding: "10px 18px",
  borderRadius: "8px",
  border: "1px solid var(--cs-accent)",
  background: "var(--cs-accent)",
  color: "var(--cs-on-accent)",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryButtonStyle = {
  padding: "10px 18px",
  borderRadius: "8px",
  border: "1px solid var(--cs-border)",
  background: "var(--cs-panel-3)",
  color: "var(--cs-text)",
  fontSize: "14px",
  cursor: "pointer",
};

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep the full detail in the console for debugging.
    console.error("App crashed:", error, info?.componentStack);
    this.setState({ info });
  }

  handleRetry = () => {
    this.setState({ error: null, info: null });
  };

  handleResetStorage = () => {
    // Bad values left in localStorage by an older version of the app are a known
    // cause of crashes on startup, so offer a clean slate.
    try {
      localStorage.clear();
    } catch (err) {
      console.warn("Could not clear localStorage:", err);
    }
    window.location.assign("/");
  };

  render() {
    if (!this.state.error) return this.props.children;

    const { error, info } = this.state;

    return (
      <div style={panelStyle}>
        <h1 style={headingStyle}>Something went wrong</h1>
        <p style={introStyle}>
          This page crashed instead of loading. The details below are the real
          error - please keep them when reporting the problem.
        </p>

        <p style={labelStyle}>Message</p>
        <pre style={messageStyle}>{String(error?.message || error)}</pre>

        {error?.stack && (
          <>
            <p style={labelStyle}>Where it happened</p>
            <pre style={codeStyle}>
              {String(error.stack).split("\n").slice(0, 8).join("\n")}
            </pre>
          </>
        )}

        {info?.componentStack && (
          <details style={{ marginBottom: "16px" }}>
            <summary style={{ cursor: "pointer", fontSize: "13px", fontWeight: 600 }}>
              Component stack
            </summary>
            <pre style={{ ...codeStyle, margin: "8px 0 0" }}>{info.componentStack}</pre>
          </details>
        )}

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button type="button" onClick={this.handleRetry} style={primaryButtonStyle}>
            Try again
          </button>
          <button
            type="button"
            onClick={this.handleResetStorage}
            style={secondaryButtonStyle}
          >
            Clear saved settings &amp; reload
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
