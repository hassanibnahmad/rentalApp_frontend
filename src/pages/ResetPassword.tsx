import { type FormEvent, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { apiClient } from "@/lib/api-client";

const ResetPassword = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";
  const [form, setForm] = useState({ newPassword: "", confirmPassword: "" });
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setFeedback({ tone: "error", message: "Lien invalide. Merci de refaire une demande." });
    }
  }, [token]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      setFeedback({ tone: "error", message: "Lien invalide ou expiré." });
      return;
    }
    const trimmedPassword = form.newPassword.trim();
    if (trimmedPassword.length < 12) {
      setFeedback({ tone: "error", message: "Le mot de passe doit contenir au moins 12 caractères." });
      return;
    }
    if (trimmedPassword !== form.confirmPassword.trim()) {
      setFeedback({ tone: "error", message: "Les mots de passe ne correspondent pas." });
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      await apiClient.post("/auth/reset-password", { token, newPassword: trimmedPassword });
      setFeedback({ tone: "success", message: "Mot de passe mis à jour. Vous pouvez vous reconnecter." });
      setTimeout(() => navigate("/login"), 2500);
      setForm({ newPassword: "", confirmPassword: "" });
    } catch (error) {
      console.error("Impossible de réinitialiser le mot de passe", error);
      const serverMessage = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
      setFeedback({
        tone: "error",
        message: serverMessage || "Lien expiré ou invalide. Veuillez refaire une demande.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <main className="mx-auto flex max-w-3xl flex-1 items-center justify-center px-4 pb-16 pt-24">
        <div className="w-full rounded-[32px] border border-white/10 bg-white/5 p-8 shadow-[0_30px_120px_rgba(2,6,23,0.7)]">
          <div className="mb-6 text-center">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Sécurité</p>
            <h1 className="text-3xl font-display font-semibold">Définir un nouveau mot de passe</h1>
            <p className="text-sm text-slate-400">Choisissez un mot de passe robuste pour sécuriser votre compte.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <label className="space-y-2 text-sm text-slate-300">
              Nouveau mot de passe
              <input
                type="password"
                required
                className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-2.5 focus:border-primary focus:outline-none"
                value={form.newPassword}
                onChange={(event) => setForm((prev) => ({ ...prev, newPassword: event.target.value }))}
              />
            </label>
            <label className="space-y-2 text-sm text-slate-300">
              Confirmation
              <input
                type="password"
                required
                className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-2.5 focus:border-primary focus:outline-none"
                value={form.confirmPassword}
                onChange={(event) => setForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
              />
            </label>

            {feedback && (
              <p
                className={`rounded-2xl border px-3 py-2 text-xs ${
                  feedback.tone === "success"
                    ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
                    : "border-red-400/40 bg-red-500/10 text-red-200"
                }`}
              >
                {feedback.message}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || !token}
              className="flex w-full items-center justify-center rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[0_20px_45px_rgba(59,130,246,0.45)] transition hover:brightness-110 disabled:opacity-50"
            >
              {submitting ? "Mise à jour..." : "Mettre à jour"}
            </button>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ResetPassword;
