import { motion } from "framer-motion";
import { Car, Zap, Eye, Headphones } from "lucide-react";

const items = [
  { icon: Car, title: "Large choix de véhicules", desc: "Des citadines aux SUV premium, trouvez la voiture parfaite." },
  { icon: Zap, title: "Service rapide", desc: "Processus de réservation simple et livraison express." },
  { icon: Eye, title: "Prix transparents", desc: "Pas de frais cachés, tout est inclus dans le prix affiché." },
  { icon: Headphones, title: "Support client 24h/24", desc: "Notre équipe est disponible à tout moment pour vous aider." },
];

const WhyChooseUs = () => (
  <section id="apropos" className="section-padding">
    <div className="container mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-14"
      >
        <h2 className="text-3xl md:text-5xl font-display font-bold mb-4">
          Pourquoi choisir <span className="text-primary">Julia Auto Cars</span>
        </h2>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {items.map((item, i) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.15 }}
            className="glass-card neon-border p-6 text-center group hover:scale-105 transition-transform duration-300"
          >
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <item.icon className="w-7 h-7 text-primary" />
            </div>
            <h3 className="font-display font-semibold text-lg mb-2">{item.title}</h3>
            <p className="text-muted-foreground text-sm">{item.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default WhyChooseUs;
