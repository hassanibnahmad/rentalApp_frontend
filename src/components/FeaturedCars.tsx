import { useMemo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { useCarInventory } from "@/contexts/CarInventoryContext";
import { cars as seedCars } from "@/data/cars";
import LuxuryCarCard from "@/components/LuxuryCarCard";

const FeaturedCars = () => {
  const navigate = useNavigate();
  const { cars: inventoryCars } = useCarInventory();

  const featuredCars = useMemo(
    () => (inventoryCars.length ? inventoryCars : seedCars).slice(0, 6),
    [inventoryCars],
  );

  const handleNavigate = (slug: string) => {
    navigate(`/voitures/${slug}`);
  };

  return (
    <section id="voitures" className="section-padding bg-[#020617] text-white">
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <p className="text-xs uppercase tracking-[0.45em] text-slate-400">Flotte connectée</p>
          <h2 className="text-3xl md:text-5xl font-display font-bold mb-4">
            Nos voitures <span className="text-gradient-gold">signatures</span>
          </h2>
          <p className="text-slate-300 max-w-2xl mx-auto">
            Sélection premium livrée partout à Agadir. Réservation instantanée via concierge Julia Auto Cars.
          </p>
        </motion.div>

        <Carousel className="relative" opts={{ align: "start", loop: true }}>
          <CarouselContent>
            {featuredCars.map((car, i) => (
              <CarouselItem key={car.slug} className="md:basis-1/2 xl:basis-1/3">
                <LuxuryCarCard car={car} index={i} variant="slider" onNavigate={handleNavigate} />
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="hidden md:flex border-white/20 text-white bg-black/40 hover:bg-primary hover:text-primary-foreground" />
          <CarouselNext className="hidden md:flex border-white/20 text-white bg-black/40 hover:bg-primary hover:text-primary-foreground" />
        </Carousel>
      </div>
    </section>
  );
};

export default FeaturedCars;
