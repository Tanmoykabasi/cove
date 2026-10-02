import { useEffect, useState } from "react";
import { ArrowUp, Moon, Sun } from "lucide-react";
import { ConnectDialog } from "@/components/chat/connect-dialog";
import { prefersDark, prefersReducedMotion, resolveTheme } from "@/lib/display/apply";
import { DARK_QUERY, useMediaQuery } from "@/lib/display/use-resolved-theme";
import { useChatStore } from "@/lib/chat/store";
import "./landing.css";

const STEPS = [
  {
    id: "tab-connect",
    label: "1 · Connect",
    title: "Add your connection details",
    body: "Point COVE at the endpoint you want to explore, then provide the matching API key.",
  },
  {
    id: "tab-discover",
    label: "2 · Discover",
    title: "Test and load the model list",
    body: "Verify the connection first. Once it responds, COVE discovers the models available through that endpoint.",
  },
  {
    id: "tab-chat",
    label: "3 · Chat",
    title: "Choose a model and begin",
    body: "Move from a quick prompt test into a familiar chat flow using the model you selected.",
  },
];

function ChainIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M10 13a5 5 0 0 0 7.54.54l2-2a5 5 0 0 0-7.07-7.07l-1.15 1.15M14 11a5 5 0 0 0-7.54-.54l-2 2a5 5 0 0 0 7.07 7.07l1.14-1.14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M21 2 13.6 9.4M15 5l4 4M9.5 13.5a5 5 0 1 1-7.07 7.07 5 5 0 0 1 7.07-7.07Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Icon({ d }: { d: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const FEATURES = [
  {
    icon: "M10 13a5 5 0 0 0 7.54.54l2-2a5 5 0 0 0-7.07-7.07l-1.15 1.15M14 11a5 5 0 0 0-7.54-.54l-2 2a5 5 0 0 0 7.07 7.07l1.14-1.14",
    title: "Bring your endpoint",
    body: "Enter a custom base URL and API key for services that follow the OpenAI-compatible /v1 convention.",
  },
  {
    icon: "M8 12l2.5 2.5L16 9m5 3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
    title: "Check before you chat",
    body: "Run a connection test first, making endpoint and credential problems easier to catch before a conversation begins.",
  },
  {
    icon: "M4 6h16M4 12h10M4 18h7M18 15v6M15 18h6",
    title: "Discover what’s available",
    body: "Load the model list from the connected endpoint instead of relying on a hard-coded catalog.",
  },
  {
    icon: "M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z",
    title: "Chat in a familiar flow",
    body: "Select a discovered model, test a prompt, or settle into a normal conversation without switching tools.",
  },
  {
    // Two panels - the A/B split.
    icon: "M4 5h6v14H4zM14 5h6v14h-6z",
    title: "Compare two at once",
    body: "Send one prompt to two models and read their answers in parallel columns, each keeping its own conversation lane.",
  },
  {
    // Bar chart - the per-reply metrics.
    icon: "M4 19V9m5 10V5m5 14v-7m5 7V8",
    title: "See what a reply costs",
    body: "Every answer carries its token counts and response time, with an optional cost estimate for the conversation.",
  },
];

const PRINCIPLES = [
  {
    icon: "M4 12h16M12 4v16",
    title: "No fixed provider catalog",
    body: "The connection begins with the compatible endpoint you choose, not a predefined list of services.",
  },
  {
    icon: "M4 6h16M4 12h16M4 18h16",
    title: "No hard-coded model menu",
    body: "Available models are discovered from the API, keeping the interface aligned with the connected account.",
  },
  {
    icon: "m5 12 4 4L19 6",
    title: "A clear test-first path",
    body: "Connection testing comes before model selection and chat, so setup feedback arrives at the right moment.",
  },
];

/**
 * First-run landing, ported from the original standalone COVE landing page and
 * shown while no endpoint is configured. The connect dialog is NOT shown
 * automatically: the reader lands on the page, scrolls it, and opens the
 * popup from a call to action ("Let's go", the nav CTA, or the closing
 * button) once they decide to connect.
 */
export function Landing({ onConnected }: { onConnected?: (models: string[]) => void }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [step, setStep] = useState(0);

  // Same store field Settings → Appearance writes, so a choice made here is the
  // choice the app opens with - and Settings shows it already selected.
  const theme = useChatStore((s) => s.display.theme);
  const setDisplay = useChatStore((s) => s.setDisplay);
  const systemDark = useMediaQuery(DARK_QUERY, prefersDark());
  const resolved = resolveTheme(theme, systemDark);
  const nextTheme = resolved === "dark" ? "light" : "dark";

  // The page is long, so a floating way back up appears once the reader is
  // past the hero - hidden again at the top, where it would just be clutter.
  const [showTop, setShowTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <div className="cove-landing" data-theme={theme === "system" ? undefined : theme}>
      <nav className="site-nav" aria-label="Primary navigation">
        <div className="wrap">
          <a className="wordmark" href="#top">
            Cove
          </a>
          <div className="nav-actions">
            <div className={`nav-links${menuOpen ? " open" : ""}`} id="nav-links">
              <a href="#features" onClick={closeMenu}>
                Features
              </a>
              <a href="#workflow" onClick={closeMenu}>
                Workflow
              </a>
              <a href="#use-cases" onClick={closeMenu}>
                Who it’s for
              </a>
              <button
                type="button"
                className="nav-cta"
                onClick={() => {
                  closeMenu();
                  setDialogOpen(true);
                }}
              >
                Let’s go
              </button>
            </div>
            <button
              className="theme-toggle"
              type="button"
              aria-label={`Switch to ${nextTheme} theme`}
              title={`Switch to ${nextTheme} theme`}
              onClick={() => setDisplay({ theme: nextTheme })}
            >
              {resolved === "dark" ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <button
              className="menu-button"
              type="button"
              aria-expanded={menuOpen}
              aria-controls="nav-links"
              aria-label={menuOpen ? "Close navigation" : "Open navigation"}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      <main>
        <header className="hero" id="top">
          <div className="wrap hero-grid">
            <div className="hero-copy">
              <p className="kicker">ONE CLIENT · YOUR ENDPOINT</p>
              <h1>
                Every compatible AI endpoint, in one calm <span className="accent">COVE.</span>
              </h1>
              <p className="lede">
                Bring your own OpenAI-compatible base URL and API key. Test the connection,
                discover available models, and move straight into a familiar chat experience -
                or put two models side by side and compare their answers.
              </p>
              <div className="hero-actions">
                <button type="button" className="button primary" onClick={() => setDialogOpen(true)}>
                  Let’s go
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="m9 18 6-6-6-6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <a className="button secondary" href="#workflow">
                  See how it works
                </a>
              </div>
              <div className="signal-row" aria-label="Core capabilities">
                <span>
                  <i />
                  OpenAI-compatible /v1
                </span>
                <span>
                  <i />
                  One-click connection test
                </span>
                <span>
                  <i />
                  Live model discovery
                </span>
                <span>
                  <i />
                  Keys stay in this browser
                </span>
              </div>
            </div>

            <div
              className="product-window"
              aria-label="Illustrative preview of the COVE connection screen"
            >
              <div className="window-top">
                <div className="window-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <span className="window-label">NEW CONNECTION</span>
              </div>
              <div className="connect-panel">
                <div className="panel-head">
                  <div>
                    <h2>Connect an endpoint</h2>
                    <p>Use any provider that follows the compatible API format.</p>
                  </div>
                  <span className="step-badge">STEP 01</span>
                </div>
                <div className="field">
                  <label>BASE URL</label>
                  <div className="fake-input">
                    <ChainIcon />
                    https://api.example.com/v1
                  </div>
                </div>
                <div className="field">
                  <label>API KEY</label>
                  <div className="fake-input">
                    <KeyIcon />
                    ••••••••••••••••••••
                  </div>
                </div>
                <div className="panel-actions">
                  <button className="test-button" type="button" disabled>
                    Test connection
                  </button>
                  <span className="ready">
                    <i />
                    Ready to test
                  </span>
                </div>
                <div className="discovery-strip">
                  <div className="mini-card">
                    <small>AFTER CONNECTING</small>
                    <strong>Browse available models</strong>
                  </div>
                  <div className="mini-card">
                    <small>THEN</small>
                    <strong>Start a new chat</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="marquee" aria-label="Compatibility summary">
          <div className="wrap">
            <strong>Designed around the OpenAI-compatible API pattern</strong>
            <div className="compat-list">
              <span>Custom base URLs</span>
              <span>Bearer API keys</span>
              <span>Model listing</span>
              <span>Chat completions</span>
              <span>Side-by-side compare</span>
              <span>Token &amp; cost tracking</span>
            </div>
          </div>
        </div>

        <section className="section-pad" id="features">
          <div className="wrap">
            <div className="section-head">
              <div>
                <span className="section-num">01 / CAPABILITIES</span>
                <h2>
                  Less setup.
                  <br />
                  More exploring.
                </h2>
              </div>
              <p>
                COVE turns endpoint setup into a clear, guided path-so you can spend less time
                wondering whether a provider is configured correctly and more time trying the
                models it exposes.
              </p>
            </div>

            <div className="feature-list">
              {FEATURES.map((feature) => (
                <article className="feature" key={feature.title}>
                  <div className="feature-icon">
                    <Icon d={feature.icon} />
                  </div>
                  <h3>{feature.title}</h3>
                  <p>{feature.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="workflow-section section-pad" id="workflow">
          <div className="wrap workflow-grid">
            <div className="workflow-copy">
              <p className="kicker">A THREE-STEP WORKFLOW</p>
              <h2>From URL to useful conversation.</h2>
              <p>One focused path keeps setup, validation, discovery, and chat connected.</p>
              <div className="tabs" role="tablist" aria-label="COVE workflow">
                {STEPS.map((entry, index) => (
                  <button
                    className="tab"
                    key={entry.id}
                    id={entry.id}
                    role="tab"
                    aria-selected={step === index}
                    aria-controls="tab-panel"
                    onClick={() => setStep(index)}
                    onKeyDown={(event) => {
                      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
                      event.preventDefault();
                      const next =
                        event.key === "ArrowRight"
                          ? (index + 1) % STEPS.length
                          : (index - 1 + STEPS.length) % STEPS.length;
                      setStep(next);
                      document.getElementById(STEPS[next].id)?.focus();
                    }}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
              <div
                className="tab-copy"
                id="tab-panel"
                role="tabpanel"
                aria-live="polite"
                aria-labelledby={STEPS[step].id}
              >
                <h3>{STEPS[step].title}</h3>
                <p>{STEPS[step].body}</p>
              </div>
            </div>

            <div className="code-card" aria-label="Illustrative endpoint configuration">
              <div className="code-head">
                <span>connection.config</span>
                <span>OpenAI compatible</span>
              </div>
              <div className="code-line">
                <span className="ln">1</span>
                <span>
                  <span className="code-key">base_url</span>:{" "}
                  <span className="code-value">&quot;https://api.example.com/v1&quot;</span>
                </span>
              </div>
              <div className="code-line">
                <span className="ln">2</span>
                <span>
                  <span className="code-key">auth</span>:{" "}
                  <span className="code-value">&quot;Bearer ••••••••••••&quot;</span>
                </span>
              </div>
              <div className="code-line">
                <span className="ln">3</span>
                <span>
                  <span className="code-key">models</span>:{" "}
                  <span className="code-dim">&quot;discover from endpoint&quot;</span>
                </span>
              </div>
              <div className="code-line">
                <span className="ln">4</span>
                <span>
                  <span className="code-key">next</span>:{" "}
                  <span className="code-good">&quot;test → choose → chat&quot;</span>
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="use-cases" id="use-cases">
          <div className="wrap">
            <div className="section-head">
              <div>
                <span className="section-num">02 / USE CASES</span>
                <h2>Built for curious builders.</h2>
              </div>
              <p>
                Useful when the endpoint changes, the model catalog is unfamiliar, or you simply
                want a clean place to test before integrating.
              </p>
            </div>
            <div className="case-grid">
              <article className="case-card">
                <span>DEVELOPERS</span>
                <div>
                  <h3>Validate a new provider before writing integration code.</h3>
                  <p>Check the endpoint and inspect what it exposes from one focused interface.</p>
                </div>
              </article>
              <article className="case-card">
                <span>AI EXPLORERS</span>
                <div>
                  <h3>Try models across compatible services.</h3>
                  <p>
                    Switch from configuration to prompting without juggling separate testing
                    tools.
                  </p>
                </div>
              </article>
              <article className="case-card">
                <span>SMALL TEAMS</span>
                <div>
                  <h3>Share a simpler testing workflow.</h3>
                  <p>Give technical and non-technical teammates the same clear connection path.</p>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="principles" id="principles">
          <div className="wrap principle-panel">
            <div>
              <span className="section-num">03 / THE IDEA</span>
              <h2>
                Your provider.
                <br />
                Your models.
                <br />
                One interface.
              </h2>
            </div>
            <div className="principle-list">
              {PRINCIPLES.map((principle) => (
                <article className="principle" key={principle.title}>
                  <Icon d={principle.icon} />
                  <div>
                    <h3>{principle.title}</h3>
                    <p>{principle.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="final" id="start">
          <div className="wrap">
            <span className="section-num">COME AS YOU API</span>
            <h2>Make any compatible endpoint feel at home.</h2>
            <p>
              COVE brings connection testing, model discovery, side-by-side comparison, token and
              cost tracking, and everyday chat into one straightforward workspace.
            </p>
            <button
              type="button"
              className="button primary"
              onClick={() => setDialogOpen(true)}
            >
              Connect your endpoint
            </button>
            <p className="fine-print">
              API credentials are sensitive. Cove keeps them in this browser&apos;s localStorage
              and never stores them anywhere else - use provider-scoped, revocable keys whenever
              your provider supports them.
            </p>
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap">
          <span>COVE · OpenAI-compatible API</span>
          <span className="build-note">Built by Tanmoy</span>
          <a href="#features">Back to capabilities</a>
        </div>
      </footer>

      <button
        type="button"
        className={`back-to-top${showTop ? " visible" : ""}`}
        aria-label="Back to top"
        title="Back to top"
        // Hidden by opacity + pointer-events only; dropping it out of the
        // accessibility tree with aria-hidden would leave keyboard and screen
        // reader users with no way back up once it is shown.
        tabIndex={showTop ? 0 : -1}
        onClick={scrollToTop}
      >
        <ArrowUp />
      </button>

      <ConnectDialog open={dialogOpen} onOpenChange={setDialogOpen} onConnected={onConnected} />
    </div>
  );
}
