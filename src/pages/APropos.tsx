import { CalendarCheck, Globe, ShieldCheck, Sparkles, Users, Waypoints } from "lucide-react";

import Navbar from "@/components/Navbar";
import WhyChooseUs from "@/components/WhyChooseUs";
import Testimonials from "@/components/Testimonials";
import Footer from "@/components/Footer";

const strategicPillars = [
  {
    label: "Conciergerie 24/7",
    description: "Équipe dédiée depuis Agadir et Marrakech pour sécuriser chaque trajet.",
    icon: Users,
  },
  {
    label: "Réseau national",
    description: "Livraison sur 6 villes clés, aéroports inclus, sans logistique externe.",
    icon: Globe,
  },
  {
    label: "Contrôle qualité",
    description: "Chaque véhicule passe 42 points de contrôle avant remise.",
    icon: ShieldCheck,
  },
];

const milestones = [
  { year: "2018", title: "Naissance de Julia Auto Cars", detail: "Premier showroom à Agadir, flotte de 8 véhicules." },
  { year: "2020", title: "Ouverture Marrakech", detail: "Déploiement chauffeur privé et partenariats hôteliers." },
  { year: "2023", title: "Digitalisation totale", detail: "Back-office unifié, suivi en temps réel, réservation en ligne." },
  { year: "2026", title: "Vision 360°", detail: "Expérience luxe multi-villes avec conciergerie connectée." },
];

const conciergeHighlights = [
  {
    title: "Livraison signature",
    copy: "Accueil personnalisé à l'aéroport avec suivi vol et chauffeur bilingue.",
    badge: "Premium meet & greet",
  },
  {
    title: "Fleet Lab",
    copy: "Atelier interne, detailing et préparation express sous 90 minutes.",
    badge: "Atelier propriétaire",
  },
  {
    title: "Data & sécurité",
    copy: "Monitoring discret, trajets assurés tous risques, notifications instantanées.",
    badge: "Pilotage en temps réel",
  },
];

const leadershipNotes = [
  {
    quote:
      "Notre objectif n'est pas de multiplier les voitures, mais de réinventer la façon de voyager entre Atlantique et désert.",
    author: "Julia Hadj-Malek",
    role: "Fondatrice & Head of Experience",
  },
  {
    quote:
      "L'innovation vient surtout du détail : un temps de réponse inférieur à 5 min change toute la perception client.",
    author: "Yassine El Idrissi",
    role: "Directeur des opérations",
  },
];

const APropos = () => (
  <div className="min-h-screen bg-[#01030F] text-white">
    <Navbar />
    <main className="mx-auto max-w-6xl px-4 pt-28 pb-20 space-y-20">
      <section className="rounded-[40px] border border-white/10 bg-gradient-to-br from-white/10 via-transparent to-slate-900/40 p-10 shadow-[0_40px_120px_rgba(2,6,23,0.65)]">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-center">
          <div className="flex-1 space-y-6">
            <p className="text-xs uppercase tracking-[0.6em] text-slate-300">Maison de mobilité privée</p>
            <h1 className="text-4xl font-display font-semibold leading-tight md:text-5xl">
              Nous orchestrons des trajets haute couture entre océan, villes impériales et désert.
            </h1>
            <p className="text-lg text-slate-300">
              Julia Auto Cars associe conciergerie, flotte premium et technologie propriétaire pour offrir une
              expérience ultra fluide aux voyageurs, dirigeants et maisons de production tournant au Maroc.
            </p>
            <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.4em] text-slate-300">
              <span className="rounded-full border border-white/20 px-4 py-2">Agadir HQ</span>
              <span className="rounded-full border border-white/20 px-4 py-2">Marrakech Studio</span>
              <span className="rounded-full border border-white/20 px-4 py-2">Concierge 24/7</span>
            </div>
          </div>
          <div className="flex-1 rounded-[32px] border border-white/10 bg-black/30 p-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4">
                <p className="text-xs uppercase tracking-[0.5em] text-primary/70">Temps moyen</p>
                <p className="mt-2 text-3xl font-display font-semibold">4 min</p>
                <p className="text-sm text-primary/80">pour confirmer un chauffeur</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.5em] text-slate-400">Livraisons / mois</p>
                <p className="mt-2 text-3xl font-display font-semibold">180+</p>
                <p className="text-sm text-slate-400">aéroports & villas</p>
              </div>
            </div>
            <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/70 p-5">
              <p className="text-xs uppercase tracking-[0.5em] text-slate-400">Trust score</p>
              <p className="mt-2 text-4xl font-display font-semibold text-emerald-300">4.9 / 5</p>
              <p className="text-sm text-slate-400">Basé sur 600+ récits clients vérifiés</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {strategicPillars.map((pillar) => {
          const Icon = pillar.icon;
          return (
            <article
              key={pillar.label}
              className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_rgba(3,7,18,0.45)]"
            >
              <Icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 text-xl font-semibold">{pillar.label}</h3>
              <p className="mt-2 text-sm text-slate-300">{pillar.description}</p>
            </article>
          );
        })}
      </section>

      <section className="rounded-[36px] border border-white/10 bg-white/5 p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.5em] text-slate-400">Timeline</p>
            <h2 className="text-3xl font-display font-semibold">Une maison construite sur le terrain</h2>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs text-slate-300">
            <CalendarCheck className="h-4 w-4" /> Suivi constant des jalons
          </span>
        </div>
        <div className="mt-8 space-y-6">
          {milestones.map((milestone) => (
            <div key={milestone.year} className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-black/30 p-5 md:flex-row md:items-center">
              <div className="text-3xl font-display font-semibold text-primary md:w-32">{milestone.year}</div>
              <div>
                <p className="text-xl font-semibold">{milestone.title}</p>
                <p className="text-sm text-slate-400">{milestone.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-[1.2fr,0.8fr]">
        <div className="rounded-[36px] border border-white/10 bg-gradient-to-b from-slate-900/80 to-black/60 p-8">
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.4em] text-slate-400">
            <Sparkles className="h-4 w-4" /> Signature concierge
          </div>
          <h2 className="mt-3 text-3xl font-display font-semibold">Une expérience calibrée pour les voyageurs experts</h2>
          <p className="mt-4 text-sm text-slate-300">
            Nos équipes cross-city synchronisent vos transferts, adaptent les itinéraires aux événements et assurent un
            suivi en direct auprès de votre assistant personnel ou production manager.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {conciergeHighlights.map((highlight) => (
              <article key={highlight.title} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-[0.4em] text-primary">{highlight.badge}</p>
                <h3 className="mt-2 text-lg font-semibold">{highlight.title}</h3>
                <p className="text-sm text-slate-300">{highlight.copy}</p>
              </article>
            ))}
          </div>
        </div>
        <div className="rounded-[36px] border border-white/10 bg-black/30 p-8 space-y-6">
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.4em] text-slate-400">
            <Waypoints className="h-4 w-4" /> Mission terrain
          </div>
          <p className="text-lg text-slate-200">
            Nous travaillons main dans la main avec les hôtels 5*, maisons d'hôtes confidentielles et agences MICE pour
            garantir un même niveau de sérénité, que ce soit pour un aller simple Agadir-Taghazout ou un roadshow de
            trois jours.
          </p>
          <div className="rounded-2xl border border-primary/30 bg-primary/10 p-5">
            <p className="text-xs uppercase tracking-[0.4em] text-primary/80">SLA public</p>
            <p className="mt-2 text-2xl font-display font-semibold">12 minutes</p>
            <p className="text-sm text-primary/70">Temps maximum pour répondre à une demande multi-voitures.</p>
          </div>
        </div>
      </section>

      <section className="rounded-[36px] border border-white/10 bg-white/5 p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.5em] text-slate-400">Leadership</p>
            <h2 className="text-3xl font-display font-semibold">Ils pilotent la vision</h2>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs text-slate-300">
            <ShieldCheck className="h-4 w-4" /> Engagement humain
          </span>
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {leadershipNotes.map((note) => (
            <article key={note.author} className="rounded-3xl border border-white/10 bg-black/30 p-6">
              <p className="text-lg text-slate-200">“{note.quote}”</p>
              <div className="mt-4 text-sm text-slate-400">
                <p className="font-semibold text-white">{note.author}</p>
                <p>{note.role}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-16">
        <WhyChooseUs />
        <Testimonials />

      </section>
    </main>
    <Footer />
  </div>
);

export default APropos;
