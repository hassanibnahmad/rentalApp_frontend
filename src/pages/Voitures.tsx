import { useEffect, useMemo, useState } from "react";
import { Crown, Sparkles, ShieldCheck, PhoneCall, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useCarInventory } from "@/contexts/CarInventoryContext";
import { cars as seedCars } from "@/data/cars";
import LuxuryCarCard from "@/components/LuxuryCarCard";
import { Slider } from "@/components/ui/slider";

const chipClasses = (isActive: boolean) =>
  `inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold transition whitespace-nowrap ${
    isActive
      ? "border-transparent bg-white text-black shadow-[0_10px_30px_rgba(255,255,255,0.2)]"
      : "border-white/20 text-slate-200 hover:border-primary/50 hover:text-primary"
  }`;

const Voitures = () => {
  const { cars, loading } = useCarInventory();
  const catalogCars = useMemo(() => (cars.length ? cars : seedCars), [cars]);
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 0]);
  const [seatRange, setSeatRange] = useState<[number, number]>([0, 0]);
  const [brandFilter, setBrandFilter] = useState<string>("all");

  const brandOptions = useMemo(
    () => Array.from(new Set(catalogCars.map((car) => car.brand))).sort(),
    [catalogCars],
  );

  const priceBounds = useMemo(() => {
    if (!catalogCars.length) {
      return { min: 0, max: 0 };
    }
    const prices = catalogCars.map((car) => car.pricePerDay);
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }, [catalogCars]);

  const seatBounds = useMemo(() => {
    if (!catalogCars.length) {
      return { min: 0, max: 0 };
    }
    const seats = catalogCars.map((car) => car.seats);
    return { min: Math.min(...seats), max: Math.max(...seats) };
  }, [catalogCars]);

  useEffect(() => {
    if (priceBounds.max > 0) {
      setPriceRange([priceBounds.min, priceBounds.max]);
    }
  }, [priceBounds.min, priceBounds.max]);

  useEffect(() => {
    if (seatBounds.max > 0) {
      setSeatRange([seatBounds.min, seatBounds.max]);
    }
  }, [seatBounds.min, seatBounds.max]);

  const clampValue = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

  const handlePriceInputChange = (index: 0 | 1, rawValue: string) => {
    const numeric = Number(rawValue);
    if (Number.isNaN(numeric)) {
      return;
    }
    setPriceRange((current) => {
      const next: [number, number] = [...current];
      if (index === 0) {
        next[0] = clampValue(numeric, priceBounds.min, Math.min(priceBounds.max, next[1]));
      } else {
        next[1] = clampValue(numeric, Math.max(priceBounds.min, next[0]), priceBounds.max);
      }
      return next;
    });
  };

  const handleSeatInputChange = (index: 0 | 1, rawValue: string) => {
    const numeric = Number(rawValue);
    if (Number.isNaN(numeric)) {
      return;
    }
    setSeatRange((current) => {
      const next: [number, number] = [...current];
      if (index === 0) {
        next[0] = clampValue(numeric, seatBounds.min, Math.min(seatBounds.max, next[1]));
      } else {
        next[1] = clampValue(numeric, Math.max(seatBounds.min, next[0]), seatBounds.max);
      }
      return next;
    });
  };

  const priceSliderDisabled = priceBounds.min === priceBounds.max;
  const seatSliderDisabled = seatBounds.min === seatBounds.max;
  const priceStep = Math.max(10, Math.round((priceBounds.max - priceBounds.min) / 12) || 10);
  const formatPrice = (value: number) => `${value.toLocaleString("fr-MA")} MAD`;
  const formatSeats = (value: number) => `${value} places`;

  const filteredCars = useMemo(
    () =>
      catalogCars.filter((car) => {
        const fullName = `${car.brand} ${car.model}`.toLowerCase();
        const matchesSearch = fullName.includes(searchTerm.toLowerCase().trim());
        const matchesPrice =
          priceRange[0] === 0 && priceRange[1] === 0
            ? true
            : car.pricePerDay >= priceRange[0] && car.pricePerDay <= priceRange[1];
        const matchesSeats =
          seatRange[0] === 0 && seatRange[1] === 0
            ? true
            : car.seats >= seatRange[0] && car.seats <= seatRange[1];
        const matchesBrand = brandFilter === "all" || car.brand === brandFilter;
        return matchesSearch && matchesPrice && matchesSeats && matchesBrand;
      }),
    [catalogCars, searchTerm, priceRange, seatRange, brandFilter],
  );

  const isPriceDefault = priceRange[0] === priceBounds.min && priceRange[1] === priceBounds.max;
  const isSeatDefault = seatRange[0] === seatBounds.min && seatRange[1] === seatBounds.max;

  const hasActiveFilters =
    searchTerm.trim().length > 0 || !isPriceDefault || !isSeatDefault || brandFilter !== "all";

  const resetFilters = () => {
    setSearchTerm("");
    setPriceRange([priceBounds.min, priceBounds.max]);
    setSeatRange([seatBounds.min, seatBounds.max]);
    setBrandFilter("all");
  };

  const heroStats = [
    {
      label: "Sélection",
      value: `${filteredCars.length}`,
      description: "Résultats selon vos filtres",
    },
    {
      label: "Premium",
      value: "24/24",
      description: "Conciergerie dédiée",
    },
    {
      label: "Assurance",
      value: "Incluse",
      description: "Couverture tous risques",
    },
  ];

  return (
    <div className="min-h-screen bg-[#03040a] text-white">
      <Navbar />
      <main className="pt-28 pb-16">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_55%)]" />
          <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "linear-gradient(120deg, #1b2436 0%, #05070f 60%)" }} />
          <div className="relative container mx-auto px-6 py-16 grid gap-12 lg:grid-cols-[2fr,1fr] items-center">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-1 text-xs uppercase tracking-[0.4em] text-slate-200/80">
                <Sparkles className="w-3 h-3" /> Sélection privée
              </p>
              <h1 className="mt-6 text-4xl md:text-6xl font-display font-semibold leading-tight">
                Flotte prestigieuse, <span className="text-gradient-gold">service signature</span>
              </h1>
              <p className="mt-4 text-lg text-slate-200 max-w-2xl">
                Découvrez nos véhicules les plus convoités, livrés préparés et connectés. Chaque modèle est
                sélectionné pour offrir un confort cinq étoiles, un design sculptural et une assistance 24/7.
              </p>
              <div className="mt-10 grid gap-6 sm:grid-cols-3">
                {heroStats.map((stat) => (
                  <div key={stat.label} className="rounded-3xl border border-white/15 bg-white/5 p-5">
                    <p className="text-sm uppercase tracking-[0.3em] text-slate-300">{stat.label}</p>
                    <p className="text-3xl font-display font-semibold text-white mt-2">{stat.value}</p>
                    <p className="text-sm text-slate-300">{stat.description}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[32px] border border-white/20 bg-white/5 p-6 backdrop-blur">
              <div className="flex items-center gap-3 text-primary text-sm font-semibold uppercase tracking-[0.4em]">
                <Crown className="w-5 h-5" /> Garantis
              </div>
              <p className="mt-4 text-2xl font-display leading-snug text-white">
                Briefing personnalisé, signature express et remise du véhicule à l'adresse de votre choix.
              </p>
              <ul className="mt-6 space-y-4 text-sm text-slate-200">
                <li className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" /> Assurance premium et assistance 24/7
                </li>
                <li className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" /> Préparation detailing avant chaque livraison
                </li>
                <li className="flex items-center gap-2">
                  <PhoneCall className="w-4 h-4 text-primary" /> Concierge WhatsApp dédié
                </li>
              </ul>
              <a
                href="https://wa.me/212661930818"
                target="_blank"
                rel="noreferrer"
                className="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-primary/90 px-5 py-3 font-semibold text-primary-foreground transition hover:bg-primary"
              >
                Réserver avec le concierge
              </a>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-6 mt-16">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Choix signature</p>
              <h2 className="text-3xl md:text-4xl font-display font-semibold text-white mt-2">
                Nos véhicules prêts à partir
              </h2>
              <p className="text-slate-300 mt-2">
                Chaque carte vous donne un aperçu du confort, des performances et des services inclus.
              </p>
            </div>
            <div className="flex gap-3 text-sm text-slate-300">
              <div className="rounded-full border border-white/15 px-4 py-2 bg-white/5">SUV</div>
              <div className="rounded-full border border-white/15 px-4 py-2 bg-white/5">Business</div>
              <div className="rounded-full border border-white/15 px-4 py-2 bg-white/5">City</div>
              <div className="rounded-full border border-white/15 px-4 py-2 bg-white/5">Éco</div>
            </div>
          </div>

          <div className="mt-8 rounded-[30px] border border-white/10 bg-white/5 p-6 backdrop-blur space-y-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="relative mt-2">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Marque ou modèle"
                  className="w-full rounded-2xl border border-white/15 bg-black/30 py-3 pl-11 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none"
                />
              </div>
              <div className="pt-2">
              <button
                type="button"
                onClick={resetFilters}
                disabled={!hasActiveFilters}
                className="w-full rounded-2xl border border-white/20 px-4 py-3 text-sm font-semibold text-white transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:border-white/10 disabled:text-slate-500"
              >
                Réinitialiser les filtres
              </button>
            </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Budget</p>
                  </div>
                  <div className="flex gap-2 text-xs font-semibold">
                    <span className="rounded-full border border-white/15 bg-black/40 px-3 py-1">
                      {priceBounds.max ? formatPrice(priceRange[0]) : "-"}
                    </span>
                    <span className="rounded-full border border-white/15 bg-black/40 px-3 py-1">
                      {priceBounds.max ? formatPrice(priceRange[1]) : "-"}
                    </span>
                  </div>
                </div>
                <Slider
                  value={priceRange}
                  min={priceBounds.min}
                  max={priceBounds.max}
                  step={priceStep}
                  onValueChange={(value) => setPriceRange([value[0], value[1]])}
                  disabled={priceSliderDisabled}
                  className="mt-4"
                />
               
              </div>

              <div className="space-y-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Places</p>
                  </div>
                  <div className="flex gap-2 text-xs font-semibold">
                    <span className="rounded-full border border-white/15 bg-black/40 px-3 py-1">
                      {seatBounds.max ? formatSeats(seatRange[0]) : "-"}
                    </span>
                    <span className="rounded-full border border-white/15 bg-black/40 px-3 py-1">
                      {seatBounds.max ? formatSeats(seatRange[1]) : "-"}
                    </span>
                  </div>
                </div>
                <Slider
                  value={seatRange}
                  min={seatBounds.min}
                  max={seatBounds.max}
                  step={1}
                  onValueChange={(value) => setSeatRange([value[0], value[1]])}
                  disabled={seatSliderDisabled}
                  className="mt-4"
                />
                
              </div>
            </div>

            <div className="space-y-4">
              <div className="text-xs uppercase tracking-[0.4em] text-slate-400">Marque</div>
              <div className="flex gap-3 overflow-x-auto pb-1 sm:overflow-hidden">
                <button
                  type="button"
                  className={chipClasses(brandFilter === "all")}
                  onClick={() => setBrandFilter("all")}
                >
                  Toutes
                </button>
                {brandOptions.map((brand) => (
                  <button
                    key={brand}
                    type="button"
                    className={chipClasses(brandFilter === brand)}
                    onClick={() => setBrandFilter(brand)}
                  >
                    {brand}
                  </button>
                ))}
              </div>
            </div>

            
          </div>

          <div className="mt-6 text-sm text-slate-300">
            {filteredCars.length} véhicule(s) correspondent à votre recherche.
          </div>

          <div className="mt-10 grid gap-8 md:grid-cols-2 xl:grid-cols-3">
            {filteredCars.map((car, index) => (
              <LuxuryCarCard
                key={car.slug}
                car={car}
                index={index}
                onNavigate={(slug) => navigate(`/voitures/${slug}`)}
              />
            ))}
          </div>

          {!filteredCars.length && !loading && (
            <p className="mt-8 rounded-2xl border border-white/10 bg-black/30 px-6 py-8 text-center text-slate-400">
              Aucun véhicule ne correspond à ces critères pour le moment.
            </p>
          )}

          {loading && <p className="mt-8 text-center text-slate-400">Chargement de la flotte...</p>}
        </section>
      </main>
      <Footer />
    </div>
  );
};
export default Voitures;
