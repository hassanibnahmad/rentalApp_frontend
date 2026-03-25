import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Gauge,
  Fuel,
  Users,
  ShieldCheck,
  RefreshCcw,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { type CarHighlightIcon } from "@/data/cars";
import { useCarInventory } from "@/contexts/CarInventoryContext";
import WhatsAppIcon from "@/components/icons/WhatsAppIcon";
import { getWhatsAppUrl } from "@/lib/contact-info";

const highlightIcons: Record<CarHighlightIcon, LucideIcon> = {
  shield: ShieldCheck,
  refresh: RefreshCcw,
  support: MessageCircle,
};

const specIconMap: Record<string, LucideIcon> = {
  Transmission: Gauge,
  Boîte: Gauge,
  Traction: Gauge,
  Carburant: Fuel,
  Conso: Fuel,
  "Consommation": Fuel,
  Capacité: Users,
  Sièges: Users,
};

const conciergePerks = [
  { title: "Livraison express", detail: "Aéroport, hôtel ou villa" },
  { title: "Concierge 24/7", detail: "WhatsApp + téléphone" },
  { title: "Couverture premium", detail: "Assurance tous risques" },
];

const CarDetails = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { cars, loading } = useCarInventory();
  const car = useMemo(() => cars.find((item) => item.slug === (slug ?? "")), [cars, slug]);
  const [selectedImage, setSelectedImage] = useState(car?.gallery?.[0]?.image ?? car?.image ?? "");

  useEffect(() => {
    if (car) {
      setSelectedImage(car.gallery?.[0]?.image ?? car.image);
    }
  }, [car]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [slug]);

  if (loading && !car) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <main className="container mx-auto px-4 pt-32 pb-24 text-center space-y-4">
          <p className="text-sm uppercase tracking-[0.4em] text-muted-foreground">Chargement</p>
          <p className="text-3xl font-display font-semibold">Nous préparons la fiche détaillée...</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (!car) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <main className="container mx-auto px-4 pt-32 pb-24">
          <div className="text-center space-y-6">
            <p className="text-2xl font-display font-semibold">Oups, voiture introuvable</p>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Le modèle demandé n'existe plus ou a été déplacé. Retournez au catalogue pour découvrir notre
              flotte complète.
            </p>
            <button
              type="button"
              className="btn-primary-glow px-6 py-3 rounded-full"
              onClick={() => navigate("/voitures")}
            >
              Voir toutes les voitures
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const reservationParams = new URLSearchParams();
  if (car.remoteId != null) {
    reservationParams.set("carId", car.remoteId.toString());
  }
  reservationParams.set("carSlug", car.slug);
  const reservationPath = reservationParams.toString() ? `/reservation?${reservationParams.toString()}` : "/reservation";
  const galleryShots = car.gallery ?? [];

  return (
    <div className="min-h-screen bg-[#01030F] text-white">
      <Navbar />
      <main className="pt-24 pb-20">
        <section className="mx-auto max-w-6xl px-4 space-y-16">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => navigate(`/voitures`)}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2 text-sm font-medium text-slate-200 transition hover:border-white/40"
            >
              <ArrowLeft className="w-4 h-4" /> Retour au catalogue
            </button>
            <span className="hidden md:inline-flex items-center rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.4em] text-slate-400">
              Fiche détaillée
            </span>
          </div>

          <div className="grid gap-10 lg:grid-cols-[1.1fr,0.9fr]">
            <div className="space-y-6">
              <div className="relative rounded-[40px] border border-white/8 bg-gradient-to-br from-slate-900 via-slate-950 to-black p-1 shadow-[0_40px_120px_rgba(2,6,23,0.65)]">
                <div className="rounded-[36px] overflow-hidden bg-black/30">
                  <img
                    src={selectedImage || car.image}
                    alt={`${car.brand} ${car.model}`}
                    className="h-[400px] w-full object-cover md:h-[480px]"
                  />
                </div>
                <Badge className="absolute top-6 left-6 bg-white/90 text-black uppercase tracking-[0.35em] text-[10px]">
                  {car.category}
                </Badge>
                <div className="pointer-events-none absolute inset-0 rounded-[38px] border border-white/10" />
              </div>

              {galleryShots.length > 0 && (
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {galleryShots.map((shot) => (
                    <button
                      key={shot.id}
                      type="button"
                      onClick={() => setSelectedImage(shot.image)}
                      className={`min-w-[120px] rounded-2xl border px-2 pt-2 pb-3 text-left transition ${
                        selectedImage === shot.image
                          ? "border-primary/70 bg-primary/10"
                          : "border-white/10 bg-white/5 hover:border-white/40"
                      }`}
                    >
                      <img
                        src={shot.image}
                        alt={shot.label}
                        className="mb-2 h-20 w-full rounded-xl object-cover"
                      />
                      <p className="text-xs font-semibold text-slate-200">{shot.label}</p>
                    </button>
                  ))}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-3">
                {conciergePerks.map((perk) => (
                  <div key={perk.title} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <p className="text-[11px] uppercase tracking-[0.4em] text-slate-400">{perk.title}</p>
                    <p className="text-sm font-semibold text-white">{perk.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <section className="space-y-6 rounded-[36px] border border-white/10 bg-white/5 p-8 shadow-[0_30px_120px_rgba(2,6,23,0.55)] backdrop-blur">
              <div>
                <p className="text-xs uppercase tracking-[0.5em] text-slate-400">{car.brand}</p>
                <h1 className="mt-3 text-4xl md:text-5xl font-display font-bold leading-tight">
                  {car.brand} {car.model}
                </h1>
                <p className="mt-4 text-4xl font-semibold text-[#FACC15]">
                  {car.pricePerDay} DH
                  <span className="text-base font-normal text-slate-300"> / jour</span>
                </p>
                <p className="mt-4 text-slate-300">{car.description}</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {car.stats.map((stat) => {
                  const Icon = specIconMap[stat.label] ?? Gauge;
                  return (
                    <div key={stat.label} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                      <Icon className="mb-3 h-5 w-5 text-primary" />
                      <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">{stat.label}</p>
                      <p className="text-base font-semibold">{stat.value}</p>
                    </div>
                  );
                })}
              </div>

              <div className="grid gap-4 text-sm text-slate-300 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <p className="text-xs uppercase tracking-[0.4em]">Livraison</p>
                  <p className="text-white font-semibold">Agadir, Taghazout, Aéroport</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <p className="text-xs uppercase tracking-[0.4em]">Dépot</p>
                  <p className="text-white font-semibold">Sans caution pour clients réguliers</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => navigate(reservationPath)}
                  className="inline-flex flex-1 min-w-[200px] items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[0_18px_45px_rgba(59,130,246,0.35)] transition hover:brightness-110"
                >
                  Réserver en ligne
                </button>
                <a
                  href={getWhatsAppUrl(car.whatsappMessage)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex flex-1 min-w-[200px] items-center justify-center gap-2 rounded-2xl border border-white/20 px-5 py-3 text-sm font-semibold text-white hover:border-white/50"
                >
                  <WhatsAppIcon className="h-4 w-4" />  WhatsApp
                </a>
              </div>
            </section>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1.1fr,0.9fr]">
            <div className="rounded-[32px] border border-white/10 bg-slate-950/60 p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.5em] text-slate-400">Équipements inclus</p>
                  <h2 className="mt-2 text-2xl font-display font-semibold">Confort & technologies à bord</h2>
                </div>
                <Badge className="rounded-full bg-primary/10 px-4 py-1 text-primary">Premium</Badge>
              </div>
              <ul className="mt-6 grid gap-3 text-sm text-slate-200 sm:grid-cols-2">
                {car.equipments.map((item) => (
                  <li key={item} className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/5 px-4 py-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-emerald-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {car.highlights.map((highlight) => {
                const Icon = highlightIcons[highlight.icon];
                return (
                  <div
                    key={highlight.title}
                    className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-transparent to-slate-950 p-5"
                  >
                    <Icon className="h-6 w-6 text-emerald-400" />
                    <h3 className="mt-3 text-lg font-semibold">{highlight.title}</h3>
                    <p className="text-sm text-slate-300">{highlight.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-white/5 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.5em] text-slate-400">Explorer</p>
                <h2 className="text-2xl font-display font-semibold">Autres modèles recommandés</h2>
              </div>
              <button
                type="button"
                className="rounded-full border border-white/15 px-5 py-2 text-xs uppercase tracking-[0.4em] text-slate-300"
                onClick={() => navigate("/voitures")}
              >
                Voir tout
              </button>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {cars
                .filter((item) => item.slug !== car.slug)
                .slice(0, 3)
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="rounded-3xl border border-white/10 bg-slate-950/60 p-4 text-left transition hover:border-primary/60"
                    onClick={() => navigate(`/voitures/${item.slug}`)}
                  >
                    <img
                      src={item.image}
                      alt={`${item.brand} ${item.model}`}
                      className="mb-4 h-36 w-full rounded-2xl object-cover"
                    />
                    <p className="text-xs uppercase tracking-[0.35em] text-slate-400">{item.brand}</p>
                    <p className="text-xl font-semibold">{item.model}</p>
                    <p className="text-sm text-slate-400">{item.pricePerDay} DH / jour</p>
                  </button>
                ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default CarDetails;
