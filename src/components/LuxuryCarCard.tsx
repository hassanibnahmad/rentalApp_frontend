import { motion } from "framer-motion";
import { Fuel, Gauge, MoveRight, Users } from "lucide-react";

import type { CarDetail } from "@/data/cars";

export type LuxuryCarCardVariant = "grid" | "slider";

type LuxuryCarCardProps = {
  car: CarDetail;
  onNavigate: (slug: string) => void;
  index?: number;
  variant?: LuxuryCarCardVariant;
};

const LuxuryCarCard = ({ car, onNavigate, index = 0, variant = "grid" }: LuxuryCarCardProps) => {
  const isSlider = variant === "slider";
  const handleNavigate = () => onNavigate(car.slug);

  const containerClasses = [
    "group relative overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-b from-white/10 via-white/5 to-transparent p-[1px]",
    isSlider ? "h-full" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const cardClasses = [
    "relative rounded-[30px] bg-[#050915] flex flex-col h-full",
    isSlider ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.05 }}
      className={containerClasses}
      role={isSlider ? "button" : undefined}
      tabIndex={isSlider ? 0 : undefined}
      aria-label={isSlider ? `Voir les détails de ${car.brand} ${car.model}` : undefined}
      onClick={isSlider ? handleNavigate : undefined}
      onKeyDown={(event) => {
        if (!isSlider) {
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleNavigate();
        }
      }}
    >
      <div className={cardClasses}>
        <div className="relative h-60 overflow-hidden rounded-t-[30px]">
          <img
            src={car.image}
            alt={`${car.brand} ${car.model}`}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent" />
          <div className="absolute top-4 left-4 rounded-full bg-white/15 px-4 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-white">
            {car.category}
          </div>
          <div className="absolute top-4 right-4 rounded-full bg-black/70 px-4 py-1 text-sm font-semibold text-white">
            {car.pricePerDay} MAD / jour
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-between p-6 space-y-6">
          <div className="flex flex-col gap-2">
            <h3 className="text-2xl font-display font-semibold text-white">
              {car.brand} <span className="text-gradient-gold">{car.model}</span>
            </h3>
            <p className="text-sm text-slate-300 line-clamp-2">{car.description}</p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-sm text-slate-200">
            <div className="rounded-2xl bg-white/5 p-3 text-center">
              <Gauge className="mx-auto mb-1 h-4 w-4 text-primary" />
              <p className="text-xs uppercase tracking-wide text-slate-400">Boîte</p>
              <p className="font-semibold">{car.transmission}</p>
            </div>
            <div className="rounded-2xl bg-white/5 p-3 text-center">
              <Fuel className="mx-auto mb-1 h-4 w-4 text-primary" />
              <p className="text-xs uppercase tracking-wide text-slate-400">Carburant</p>
              <p className="font-semibold">{car.fuel}</p>
            </div>
            <div className="rounded-2xl bg-white/5 p-3 text-center">
              <Users className="mx-auto mb-1 h-4 w-4 text-primary" />
              <p className="text-xs uppercase tracking-wide text-slate-400">Places</p>
              <p className="font-semibold">{car.seats}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleNavigate();
              }}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-white text-black px-5 py-3 font-semibold transition group-hover:bg-primary group-hover:text-primary-foreground"
            >
              Voir les détails <MoveRight className="h-4 w-4" />
            </button>
            <a
              href={`https://wa.me/212661930818?text=${encodeURIComponent(car.whatsappMessage)}`}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="flex-1 inline-flex items-center justify-center rounded-2xl border border-white/30 px-5 py-3 text-sm font-semibold text-white transition hover:border-primary hover:text-primary"
            >
              Discuter WhatsApp
            </a>
          </div>
        </div>
      </div>
    </motion.article>
  );
};

export default LuxuryCarCard;
