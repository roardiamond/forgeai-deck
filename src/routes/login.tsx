import { useState, type FormEvent } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Mark } from "@/components/forge/mark";
import { Button } from "@/components/ui/button";
import { emailAndPasswordEnabled } from "@/lib/auth/email-password";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({
  component: Login,
});

function Login() {
  const { user, isPending } = useCurrentUserState();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function onSignIn(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const { error } = await authClient.signIn.email({ email, password, callbackURL: "/" });
    setBusy(false);
    if (error) setMessage(error.message || "Could not sign in.");
  }

  async function onCreate() {
    setBusy(true);
    setMessage("");
    const name = email.split("@")[0] || "User";
    const { error } = await authClient.signUp.email({ email, password, name, callbackURL: "/" });
    setBusy(false);
    if (error) setMessage(error.message || "Could not create the account.");
  }

  return (
    <main className="grid min-h-dvh place-items-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Mark />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-balance">Sign in to ForgeAI</h1>
        <p className="mt-2 text-sm text-pretty text-muted">
          Outcomes stay with your account. Paste a brief, a log, or a sheet and forge a document you can ship.
        </p>
        <div className="mt-8 grid gap-2">
          {isPending ? (
            <div className="h-11 animate-pulse rounded-sm bg-surface-2" />
          ) : user ? (
            <Navigate to="/" />
          ) : authEnabled ? (
            <>
              {emailAndPasswordEnabled ? (
                <form onSubmit={onSignIn} className="grid gap-2">
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Email"
                    aria-label="Email"
                    className="focus-ring h-11 w-full rounded-sm bg-bg px-3 text-sm text-fg outline-none placeholder:text-muted"
                  />
                  <input
                    type="password"
                    required
                    minLength={8}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Password"
                    aria-label="Password"
                    className="focus-ring h-11 w-full rounded-sm bg-bg px-3 text-sm text-fg outline-none placeholder:text-muted"
                  />
                  <Button type="submit" disabled={busy}>
                    Sign in
                  </Button>
                  <Button type="button" variant="secondary" disabled={busy} onClick={onCreate}>
                    Create account
                  </Button>
                  {message ? <p className="text-sm text-danger">{message}</p> : null}
                </form>
              ) : null}
              {GROK_PROVIDERS.map((provider) => (
                <Button
                  key={provider.providerId}
                  variant="secondary"
                  onClick={() => signIn(provider.providerId, { callbackURL: "/" })}
                >
                  Continue with {provider.label}
                </Button>
              ))}
            </>
          ) : (
            <p className="text-sm text-muted">Sign-in is not available.</p>
          )}
        </div>
      </div>
    </main>
  );
}