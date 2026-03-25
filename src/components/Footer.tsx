import { Facebook, Instagram, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";

const footerLinks = [
  { label: "Accueil", to: "/" },
  { label: "Voitures", to: "/voitures" },
  { label: "Réservation", to: "/reservation" },
  { label: "Contact", to: "/contact" },
];

const Footer = () => (
  <footer className="border-t border-foreground/5 py-12 px-4">
    <div className="container mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
      {/* Brand */}
      <div>
        <h3 className="text-xl font-display font-bold mb-3">
          Julia <span className="text-primary">Auto</span> <span className="text-accent">Cars</span>
        </h3>
        <p className="text-muted-foreground text-sm">
          Location de voitures à Agadir, Maroc. Service premium, prix compétitifs.
        </p>
      </div>

      {/* Links */}
      <div>
        <h4 className="font-display font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">Liens rapides</h4>
        <ul className="space-y-2 text-sm">
          {footerLinks.map((l) => (
            <li key={l.to}>
              <Link to={l.to} className="text-muted-foreground hover:text-foreground transition-colors">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Contact */}
      <div>
        <h4 className="font-display font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">Contact</h4>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>+212 6 61 93 08 18</li>
          <li>+212 6 57 44 66 30</li>
          <li>JuliaAutoCars@gmail.com</li>
        </ul>
      </div>

      {/* Social */}
      <div>
        <h4 className="font-display font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">Suivez-nous</h4>
        <div className="flex gap-3">
          {[
            { icon: Facebook, href: "#", label: "Facebook" },
            { icon: Instagram, href: "#", label: "Instagram" },
            { icon: MessageCircle, href: "https://wa.me/212661930818", label: "WhatsApp" },
          ].map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center hover:bg-primary/20 transition-colors"
              aria-label={s.label}
            >
              <s.icon className="w-5 h-5" />
            </a>
          ))}
        </div>
      </div>
    </div>

    <div className="container mx-auto mt-10 pt-6 border-t border-foreground/5 text-center text-sm text-muted-foreground">
      © 2026 Julia Auto Cars. Tous droits réservés.
    </div>
  </footer>
);

export default Footer;
