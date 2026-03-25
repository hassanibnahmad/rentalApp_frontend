import { motion } from "framer-motion";
import { CarFront, CalendarDays, CheckCircle2, PackageCheck } from "lucide-react";

const steps = [
  { icon: CarFront, title: "Choisir une voiture", desc: "Parcourez notre catalogue et sélectionnez le véhicule idéal." },
  { icon: CalendarDays, title: "Sélectionner les dates", desc: "Indiquez vos dates de prise en charge et de retour." },
  { icon: CheckCircle2, title: "Confirmer la réservation", desc: "Validez votre réservation en quelques clics via WhatsApp." },
  { icon: PackageCheck, title: "Recevoir la voiture", desc: "Récupérez votre voiture à l'aéroport ou à notre agence." },
];

const ReservationSteps = () => (
  <section id="reservation" className="section-padding bg-secondary/30">
    <div className="container mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-14"
      >
        <h2 className="text-3xl md:text-5xl font-display font-bold mb-4">
          Comment <span className="text-gradient-gold">réserver</span>
        </h2>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
        {/* Connector line */}
        <div className="hidden md:block absolute top-12 left-[12.5%] right-[12.5%] h-0.5 bg-gradient-to-r from-primary via-accent to-primary opacity-30" />

        {steps.map((step, i) => (
          <motion.div
            key={step.title}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.2 }}
            className="text-center relative"
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/15 flex items-center justify-center relative z-10 border-2 border-primary/30">
              <step.icon className="w-7 h-7 text-primary" />
            </div>
            <span className="text-accent font-bold text-sm mb-2 block">Étape {i + 1}</span>
            <h3 className="font-display font-semibold mb-1">{step.title}</h3>
            <p className="text-muted-foreground text-sm">{step.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default ReservationSteps;
