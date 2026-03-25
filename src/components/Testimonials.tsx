import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { TestimonialsCarousel, type Testimonial } from "@/components/ui/testimonials-carousel";

const testimonials: Array<Testimonial & { rating: number }> = [
  {
    name: "Ahmed K.",
    role: "Entrepreneur, Paris",
    text: "Service impeccable ! Voiture propre et livraison à l'aéroport très rapide. Je recommande vivement.",
    highlight: "livraison",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
    rating: 5,
  },
  {
    name: "Sophie M.",
    role: "Product designer",
    text: "Excellente expérience. Prix très compétitifs par rapport aux autres agences à Agadir.",
    highlight: "Prix très compétitifs",
    image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&q=80",
    rating: 5,
  },
  {
    name: "Pierre L.",
    role: "Consultant",
    text: "Très professionnel. Le support WhatsApp est super réactif. Je reviendrai certainement !",
    highlight: "support WhatsApp",
        image: "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=200&q=80",
    rating: 5,
  },
  {
    name: "Fatima Z.",
    role: "Fondatrice Maison OUMA",
    text: "J'ai loué une Tucson pour une semaine. Parfait état, et le processus était très simple.",
    highlight: "processus",
    image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80",
    rating: 4,
  },
  {
    name: "Mohamed B.",
    role: "Touriste",
    text: "Très bonne expérience. La voiture était impeccable et le service client était très réactif.",
    highlight: "service client",
    image: "https://headsupfortails.com/cdn/shop/articles/Welcoming_a_Cat_to_a_New_Home_x630.jpg?v=1741258295",
    rating: 5,
  }
];

const Testimonials = () => {
  const averageRating = testimonials.reduce((sum, item) => sum + item.rating, 0) / testimonials.length;
  const formattedAverage = averageRating.toFixed(1);
  const firstRow = testimonials;
  const secondRow = [...testimonials].reverse();

  return (
    <section className="section-padding  text-white">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Retour d'expérience</p>
          <h2 className="text-3xl md:text-5xl font-display font-bold mb-4">
            Avis <span className="text-primary">clients</span>
          </h2>
          <div className="mt-4 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-6 py-2 text-sm text-white">
            <div className="flex items-center gap-1 text-accent">
              {Array.from({ length: 5 }).map((_, index) => (
                <Star
                  key={index}
                  className={`w-4 h-4 ${index + 1 <= Math.round(averageRating) ? "fill-accent text-accent" : "text-muted-foreground"}`}
                />
              ))}
            </div>
            <span className="font-semibold text-foreground">
              {formattedAverage}/5 • {testimonials.length} avis vérifiés
            </span>
          </div>
        </motion.div>

        <div className="rounded-[36px] border border-white/10 bg-gradient-to-b from-white/5 via-transparent to-transparent p-8 md:p-10 space-y-6 shadow-[0_30px_120px_rgba(2,6,23,0.7)]">
          <TestimonialsCarousel testimonials={firstRow} speed={30} cardHeight={200} />
          <TestimonialsCarousel testimonials={secondRow} direction="right" speed={28} cardHeight={200} className="opacity-80" />
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
