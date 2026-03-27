import { type FormEvent, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api-client";
import { resolveFriendlyError } from "@/lib/errors";
import { useToast } from "@/components/ui/use-toast";

const mockEnabled = import.meta.env.VITE_ENABLE_MOCK_AUTH === "true";

const resetCopy = {
  title: "Mot de passe oublié",
  description: "Indiquez votre email professionnel pour recevoir un lien sécurisé.",
  cta: "Envoyer le lien",
};

const errorCopy = {
  invalidEmail: "Adresse e-mail invalide",
  requiredField: "Ce champ est requis",
  wrongPassword: "Mot de passe incorrect",
  wrongCredentials: "Email ou mot de passe incorrect",
  noAccount: "Votre compte n'existe pas",
  rateLimited: "Trop de tentatives, réessayez plus tard",
};

const Login = () => {
  const { login, isLoading } = useAuth();
  const { toast } = useToast();
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetFeedback, setResetFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const redirectFrom = (location.state as { from?: string } | null)?.from;

  const toggleResetForm = () => {
    setResetFeedback(null);
    setResetOpen((prev) => !prev);
    setResetEmail((previous) => previous || credentials.email);
  };

  const handleResetSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const targetEmail = (resetEmail || credentials.email).trim();
    if (!targetEmail) {
      const message = errorCopy.requiredField;
      setResetFeedback({ tone: "error", message });
      toast({ title: "Information manquante", description: message, variant: "destructive" });
      return;
    }
    setResetFeedback(null);
    setResetLoading(true);
    try {
      await apiClient.post("/auth/forgot-password", { email: targetEmail });
      const successMessage = "Un lien sécurisé vient d'être envoyé s'il s'agit d'un compte valide.";
      setResetFeedback({
        tone: "success",
        message: successMessage,
      });
      toast({ title: "Demande envoyée", description: successMessage });
    } catch (supportError) {
      const message = resolveFriendlyError(supportError, {
        defaultMessage: "Impossible de traiter la demande pour le moment.",
        network: "Serveur injoignable. Merci de réessayer dans un instant.",
      });
      setResetFeedback({
        tone: "error",
        message,
      });
      toast({
        title: "Erreur",
        description: message,
        variant: "destructive",
      });
    } finally {
      setResetLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const trimmedEmail = credentials.email.trim();
    if (!trimmedEmail) {
      setError(errorCopy.requiredField);
      toast({ title: "Adresse requise", description: errorCopy.requiredField, variant: "destructive" });
      return;
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(trimmedEmail)) {
      setError(errorCopy.invalidEmail);
      toast({
        title: errorCopy.invalidEmail,
        description: "Utilisez une adresse professionnelle au format nom@domaine.com.",
        variant: "destructive",
      });
      return;
    }
    if (!credentials.password) {
      setError(errorCopy.requiredField);
      toast({ title: "Mot de passe requis", description: errorCopy.requiredField, variant: "destructive" });
      return;
    }
    try {
      const user = await login({ email: trimmedEmail, password: credentials.password });
      if (user.role === "admin") {
        toast({ title: "Connexion réussie", description: "Bienvenue dans le centre de commandes." });
        navigate("/admin", { replace: true });
        return;
      }
      if (redirectFrom && redirectFrom !== "/admin") {
        navigate(redirectFrom, { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    } catch (loginError) {
      const friendlyMessage = resolveFriendlyError(loginError, {
        defaultMessage: errorCopy.wrongCredentials,
        unauthorized: errorCopy.wrongCredentials,
        forbidden: errorCopy.wrongPassword,
        notFound: errorCopy.noAccount,
        network: "Serveur injoignable. Vérifiez votre connexion.",
      });
      setError(friendlyMessage);
      toast({
        title: "Connexion refusée",
        description: friendlyMessage,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <main className="mx-auto flex max-w-6xl flex-1 items-center justify-center px-4 pb-16 pt-28">
        <div className="w-full max-w-md rounded-[32px] border border-white/10 bg-white/5 p-8 shadow-[0_30px_120px_rgba(2,6,23,0.7)]">
          <div className="mb-8 text-center">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Espace securise</p>
            <h1 className="text-3xl font-display font-semibold">Connexion</h1>
            <p className="text-sm text-slate-400">
              Identifiez-vous pour acceder au tableau de bord et suivre vos demandes.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="space-y-2 text-sm text-slate-300">
              Email professionnel
              <input
                type="email"
                name="email"
                autoComplete="email"
                required
                className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-2.5 focus:border-primary focus:outline-none"
                value={credentials.email}
                onChange={(event) =>
                  setCredentials((prev) => ({ ...prev, email: event.target.value.trim() }))
                }
              />
            </label>
            <label className="space-y-2 text-sm text-slate-300">
              Mot de passe
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                required
                className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-2.5 focus:border-primary focus:outline-none"
                value={credentials.password}
                onChange={(event) =>
                  setCredentials((prev) => ({ ...prev, password: event.target.value }))
                }
              />
            </label>

            {error && (
              <p className="rounded-2xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[0_20px_45px_rgba(59,130,246,0.45)] transition hover:brightness-110 disabled:opacity-60"
            >
              {isLoading ? "Connexion en cours" : "Se connecter"}
            </button>
          </form>

          <div className="mt-6 space-y-2 text-center text-xs text-slate-400">
            <p>Besoin d'aide ?</p>
            <div className="flex flex-wrap justify-center gap-3 text-primary font-semibold">
              <button type="button" className="hover:underline" onClick={toggleResetForm}>
                Mot de passe oublié ?
              </button>
            </div>
           
          </div>

          {resetOpen && (
            <form
              onSubmit={handleResetSubmit}
              className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5 text-left"
            >
              <div>
                <p className="text-sm font-semibold text-white">{resetCopy.title}</p>
                <p className="text-xs text-slate-400">{resetCopy.description}</p>
              </div>
              <label className="space-y-1 text-xs text-slate-300">
                Email professionnel
                <input
                  type="email"
                  autoComplete="email"
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  value={resetEmail || credentials.email}
                  onChange={(event) => setResetEmail(event.target.value.trim())}
                  required
                />
              </label>

              {resetFeedback && (
                <p
                  className={`rounded-2xl border px-3 py-2 text-xs ${
                    resetFeedback.tone === "success"
                      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
                      : "border-red-400/40 bg-red-500/10 text-red-200"
                  }`}
                >
                  {resetFeedback.message}
                </p>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setResetOpen(false);
                    setResetFeedback(null);
                  }}
                  className="rounded-2xl border border-white/20 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow disabled:opacity-60"
                >
                  {resetLoading ? "Traitement..." : resetCopy.cta}
                </button>
              </div>
            </form>
          )}

          {mockEnabled && (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-slate-300">
              <p className="mb-1 font-semibold">Comptes demo</p>
              <p>Admin: admin@julia.cars / admin123</p>
              <p>Client: client@julia.cars / client123</p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Login;
