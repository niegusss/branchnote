import { useEffect, useRef, useState } from "react";
import { Monitor, Moon, Sun, X } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { Theme } from "../lib/theme";
import type { DeviceCodeInfo } from "../types";
import { btnPrimary, btnSecondary, textInput } from "../lib/ui";
import {
  gitClearHttpsAuth,
  gitGetIdentity,
  gitGetRemote,
  gitHttpsAccount,
  gitSetHttpsAuth,
  gitSetIdentity,
  gitSetRemote,
  gitTestRemote,
  githubDevicePoll,
  githubDeviceStart,
} from "../lib/git";

interface SettingsProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  vaultPath: string | null;
  onChangeVault: () => void;
  onClose: () => void;
}

const THEME_OPTIONS: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

function formatErr(e: unknown): string {
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  return String(e);
}

const fieldLabel = "mb-1 block text-xs font-medium text-muted";

/** Git config + auth, scoped to the open vault. Calls the git IPC directly. */
function GitSettings({ vaultPath }: { vaultPath: string }) {
  const [remote, setRemote] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [authUser, setAuthUser] = useState("");
  const [token, setToken] = useState("");
  /** Stored HTTPS account name, or null when not signed in. */
  const [account, setAccount] = useState<string | null>(null);
  /** Active device-flow handshake, or null when not signing in. */
  const [device, setDevice] = useState<DeviceCodeInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [r, id, acc] = await Promise.all([
          gitGetRemote(vaultPath),
          gitGetIdentity(vaultPath),
          gitHttpsAccount(),
        ]);
        if (cancelled) return;
        setRemote(r ?? "");
        setName(id.name);
        setEmail(id.email);
        setAccount(acc);
      } catch (e) {
        if (!cancelled) setError(formatErr(e));
      }
    })();
    return () => {
      cancelled = true;
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [vaultPath]);

  async function run(action: () => Promise<void>, ok: string) {
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(ok);
    } catch (e) {
      setError(formatErr(e));
    }
  }

  function stopSignIn() {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
    setDevice(null);
  }

  /** Begin the GitHub device flow: show the code, open the browser, then poll
   * until GitHub reports the user authorized (token is stored Rust-side). */
  async function startSignIn() {
    setError(null);
    setNotice(null);
    let d: DeviceCodeInfo;
    try {
      d = await githubDeviceStart();
    } catch (e) {
      setError(formatErr(e));
      return;
    }
    setDevice(d);
    try {
      await openUrl(d.verificationUri);
    } catch {
      // Browser didn't open automatically — the user can click "Open GitHub".
    }

    let intervalMs = d.interval * 1000;
    const deadline = Date.now() + d.expiresIn * 1000;
    const poll = async () => {
      if (Date.now() > deadline) {
        stopSignIn();
        setError("Sign-in timed out — start again");
        return;
      }
      try {
        const status = await githubDevicePoll(d.deviceCode);
        if (status === "authorized") {
          const acc = await gitHttpsAccount();
          stopSignIn();
          setAccount(acc);
          setNotice(acc ? `Signed in as ${acc}` : "Signed in");
          return;
        }
        if (status === "slow_down") intervalMs += 5000;
        pollTimer.current = setTimeout(() => void poll(), intervalMs);
      } catch (e) {
        stopSignIn();
        setError(formatErr(e));
      }
    };
    pollTimer.current = setTimeout(() => void poll(), intervalMs);
  }

  return (
    <section>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">Git</h3>

      {error && <p className="mb-2 text-xs text-danger">{error}</p>}
      {notice && <p className="mb-2 text-xs text-accent">{notice}</p>}

      <div className="space-y-4">
        <div>
          <label className={fieldLabel}>Remote URL (origin)</label>
          <div className="flex gap-2">
            <input
              value={remote}
              onChange={(e) => setRemote(e.currentTarget.value)}
              placeholder="https://github.com/user/repo.git"
              className={textInput}
            />
            <button
              type="button"
              onClick={() => void run(() => gitSetRemote(vaultPath, remote), "Remote saved")}
              className={btnSecondary}
            >
              Save
            </button>
          </div>
          <button
            type="button"
            onClick={() => void run(() => gitTestRemote(vaultPath), "Connection OK")}
            className={`${btnSecondary} mt-2`}
          >
            Test connection
          </button>
        </div>

        <div>
          <label className={fieldLabel}>Identity</label>
          <div className="space-y-2">
            <input
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              placeholder="Your name"
              className={textInput}
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              placeholder="you@example.com"
              className={textInput}
            />
            <button
              type="button"
              onClick={() =>
                void run(() => gitSetIdentity(vaultPath, name, email), "Identity saved")
              }
              className={btnSecondary}
            >
              Save identity
            </button>
          </div>
        </div>

        <div>
          <label className={fieldLabel}>Authentication</label>
          {account ? (
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-sm text-ink">
                Signed in as <span className="font-medium">{account}</span>
              </span>
              <button
                type="button"
                onClick={() =>
                  void run(async () => {
                    await gitClearHttpsAuth();
                    setAccount(null);
                  }, "Signed out")
                }
                className={btnSecondary}
              >
                Sign out
              </button>
            </div>
          ) : device ? (
            <div className="space-y-2">
              <p className="text-xs text-muted">
                Enter this code at{" "}
                <span className="text-ink">github.com/login/device</span>:
              </p>
              <div className="flex items-center gap-2">
                <code className="rounded-md border border-line bg-bg px-2 py-1 font-mono text-base tracking-widest text-ink">
                  {device.userCode}
                </code>
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(device.userCode)}
                  className={btnSecondary}
                >
                  Copy
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void openUrl(device.verificationUri)}
                  className={btnSecondary}
                >
                  Open GitHub
                </button>
                <button type="button" onClick={stopSignIn} className={btnSecondary}>
                  Cancel
                </button>
              </div>
              <p className="text-xs text-faint">Waiting for authorization…</p>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => void startSignIn()}
                className={btnPrimary}
              >
                Sign in with GitHub
              </button>
              <details className="group">
                <summary className="cursor-pointer text-xs text-muted hover:text-ink">
                  Use a token instead
                </summary>
                <div className="mt-2 space-y-2">
                  <input
                    value={authUser}
                    onChange={(e) => setAuthUser(e.currentTarget.value)}
                    placeholder="HTTPS username (optional; defaults to git)"
                    className={textInput}
                  />
                  <input
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.currentTarget.value)}
                    placeholder="Personal access token"
                    className={textInput}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      void run(async () => {
                        await gitSetHttpsAuth(authUser, token);
                        setToken("");
                        setAccount(await gitHttpsAccount());
                      }, "Token saved")
                    }
                    disabled={!token.trim()}
                    className={btnPrimary}
                  >
                    Save token
                  </button>
                </div>
              </details>
            </div>
          )}
          <p className="mt-2 text-xs text-faint">
            SSH: set the remote to <span className="text-muted">git@github.com:…</span> and
            load your key in ssh-agent (or keep ~/.ssh/id_ed25519 / id_rsa).
          </p>
        </div>
      </div>
    </section>
  );
}

/** Settings modal: appearance, vault, and git config/auth. */
export function Settings({
  theme,
  onThemeChange,
  vaultPath,
  onChangeVault,
  onClose,
}: SettingsProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-line bg-card shadow-popover"
      >
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="rounded-md p-1 text-muted transition-colors hover:bg-hover hover:text-ink active:scale-95"
          >
            <X size={16} aria-hidden />
            <span className="sr-only">Close settings</span>
          </button>
        </header>

        <div className="space-y-6 overflow-y-auto px-4 py-4">
          <section>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">
              Appearance
            </h3>
            <div className="grid grid-cols-3 gap-1.5">
              {THEME_OPTIONS.map(({ value, label, Icon }) => {
                const selected = theme === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onThemeChange(value)}
                    aria-pressed={selected}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-sm transition-colors active:scale-[0.98] ${
                      selected
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-line text-muted hover:bg-hover hover:text-ink"
                    }`}
                  >
                    <Icon size={18} aria-hidden />
                    {label}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">
              Vault
            </h3>
            <p className="mb-2 truncate text-sm text-muted" title={vaultPath ?? ""}>
              {vaultPath ?? "No vault open"}
            </p>
            <button type="button" onClick={onChangeVault} className={btnSecondary}>
              Change vault…
            </button>
          </section>

          {vaultPath && <GitSettings vaultPath={vaultPath} />}
        </div>
      </div>
    </div>
  );
}
