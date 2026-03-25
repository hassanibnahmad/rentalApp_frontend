import { motion } from "framer-motion";
import { Gauge, Users, Fuel, LucideIcon } from "lucide-react";

import { useCarInventory } from "@/contexts/CarInventoryContext";

const statIconMap: Record<string, LucideIcon> = {
  Transmission: Gauge,
  Boîte: Gauge,
  Traction: Gauge,
  Capacité: Users,
  Sièges: Users,
  Carburant: Fuel,
  "Consommation": Fuel,
  Conso: Fuel,
};

const CarDetailShowcase = () => {
  const { cars } = useCarInventory();
  const spotlightCars = cars.slice(0, 4);

  if (!spotlightCars.length) {
    return null;
  }

  return (
    <section className="section-padding bg-secondary/30">
      <div className="container mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-14">
        <p className="text-sm font-semibold tracking-widest uppercase text-primary mb-3">
          Voitures détaillées
        </p>
        <h2 className="text-3xl md:text-5xl font-display font-bold mb-4">
          Visualisez l'intérieur et l'extérieur
        </h2>
        <p className="text-muted-foreground">
          Une sélection de nos modèles prêts à être livrés : découvrez l'espace, les finitions et les
          équipements grâce à cette galerie rapide.
        </p>
      </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {spotlightCars.map((car, index) => (
          <motion.article
            key={`${car.brand}-${car.model}`}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 }}
            className="glass-card overflow-hidden"
          >
            <div className="relative">
              <img
                src={car.image}
                alt={`${car.brand} ${car.model}`}
                className="w-full h-64 object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent" />
              <div className="absolute bottom-4 left-4">
                <span className="text-xs uppercase tracking-[0.3em] text-accent">
                  {car.category}
                </span>
                <h3 className="text-2xl font-display font-semibold text-white">
                  {car.brand} <span className="text-accent">{car.model}</span>
                </h3>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-muted-foreground">{car.description}</p>
              <div className="grid grid-cols-3 gap-3">
                {car.stats.map((stat) => {
                  const Icon = statIconMap[stat.label] ?? Gauge;
                  return (
                    <div
                      key={stat.label}
                      className="rounded-xl border border-foreground/10 p-3 text-center"
                    >
                      <Icon className="w-5 h-5 mx-auto mb-2 text-primary" />
                      <p className="text-xs uppercase text-muted-foreground tracking-wide">
                        {stat.label}
                      </p>
                      <p className="text-sm font-semibold">{stat.value}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.article>
        ))}
        </div>
      </div>
    </section>
  );
};

export default CarDetailShowcase;
