import { motion } from "framer-motion";
import { Plane, BadgeDollarSign, ShieldCheck, Headphones, Clock3, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import heroBg from "@/assets/hero-bg.jpg";

const stats = [
  { label: "Livraison express", value: "< 20 min", helper: "Aéroport & hôtels" },
  { label: "Concierge", value: "24/7", helper: "Support WhatsApp" },
  { label: "Satisfaction", value: "4.9 / 5", helper: "+320 avis clients" },
];

const assurance = [
  { icon: Plane, label: "Livraison aéroport" },
  { icon: BadgeDollarSign, label: "Prix exécutifs" },
  { icon: ShieldCheck, label: "Assurance premium" },
  { icon: Headphones, label: "Support 24/7" },
];

const HeroSection = () => (
  <section className="relative overflow-hidden bg-[#01030F] text-white">
    <div className="absolute inset-0">
      <img src={heroBg} alt="Voitures de luxe Julia Auto Cars" className="w-full h-full object-cover" loading="eager" />
      <div className="absolute inset-0 bg-gradient-to-br from-[#00040f] via-[#020818]/95 to-[#050221]" />
      <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-primary/30 blur-[140px]" />
      <div className="absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-accent/30 blur-[150px]" />
    </div>

    <div className="relative z-10 container mx-auto px-4 pt-32 pb-24">
      <div className="grid gap-12 lg:grid-cols-[1.05fr,0.95fr] items-center">
        <div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-[13px] uppercase tracking-[0.4em] text-slate-300">
              <Sparkles className="w-4 h-4 text-primary" /> Premium Car Rental
            </p>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-6 text-4xl md:text-6xl xl:text-7xl font-display font-bold leading-tight"
          >
            Louez votre voiture <span className="text-gradient-gold">idéale</span> à Agadir
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-6 text-lg md:text-xl text-slate-300 max-w-2xl"
          >
            Livraison aéroport, flotte connectée et conciergerie 24/7 pour vos séjours business ou lifestyle. Chaque location inclut assurance premium et assistance complète.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="mt-10 flex flex-col gap-4 sm:flex-row"
          >
            <Link to="/voitures" className="btn-primary-glow text-base px-8 py-3">Explorer la flotte</Link>
            <a
              href="https://wa.me/212661930818"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-accent-glow text-base px-8 py-3"
            >
              Réserver en direct
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.45 }}
            className="mt-12 grid gap-4 sm:grid-cols-3"
          >
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_25px_60px_rgba(2,6,23,0.45)]">
                <p className="text-xs uppercase tracking-[0.4em] text-slate-400">{stat.label}</p>
                <p className="mt-3 text-2xl font-semibold text-white">{stat.value}</p>
                <p className="text-sm text-slate-400">{stat.helper}</p>
              </div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            transition={{ delay: 0.55 }}
            className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            {assurance.map((item) => (
              <div key={item.label} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <item.icon className="w-5 h-5 text-accent" />
                <span className="text-sm font-medium text-slate-100">{item.label}</span>
              </div>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="relative"
        >
          <div className="relative rounded-[36px] border border-white/10 bg-gradient-to-b from-white/10 via-transparent to-slate-900/60 p-4 shadow-[0_45px_120px_rgba(4,6,33,0.6)]">
            <div className="rounded-[28px] overflow-hidden">
              <img src={heroBg} alt="Supercars Julia Auto Cars" className="h-[420px] w-full object-cover" />
            </div>
            <div className="absolute inset-0 rounded-[30px] border border-white/10 pointer-events-none" />
          </div>

          <div className="absolute -left-8 -top-10 w-48 rounded-3xl border border-white/10 bg-[#020617]/90 p-4 shadow-[0_15px_45px_rgba(2,6,23,0.6)]">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Dernière course</p>
            <p className="mt-2 text-base font-semibold text-white">Classe E avec chauffeur</p>
            <p className="text-sm text-slate-400">Livrée à l'aéroport</p>
          </div>

          <div className="absolute -right-6 bottom-8 w-56 rounded-3xl border border-white/10 bg-white/5 p-4 text-white shadow-[0_15px_45px_rgba(2,6,23,0.5)]">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.4em] text-slate-400">
              <span>Disponibilité</span>
              <Clock3 className="w-4 h-4" />
            </div>
            <p className="mt-3 text-2xl font-semibold text-accent">Instantanée</p>
            <p className="text-sm text-slate-300">Confirmations en moins de 5 min</p>
          </div>
        </motion.div>
      </div>
    </div>
  </section>
);

export default HeroSection;
