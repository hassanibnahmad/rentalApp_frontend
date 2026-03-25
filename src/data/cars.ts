import carLogan from "@/assets/car-logan.jpg";
import carTucson from "@/assets/car-tucson.jpg";
import carGolf from "@/assets/car-golf.jpg";
import carClio from "@/assets/car-clio.jpg";
import carCorolla from "@/assets/car-corolla.jpg";
import carMercedes from "@/assets/car-mercedes.jpg";

export type CarHighlightIcon = "shield" | "refresh" | "support";

export type CarDetail = {
  id: string;
  remoteId?: number;
  slug: string;
  brand: string;
  model: string;
  category: string;
  description: string;
  pricePerDay: number;
  transmission: string;
  fuel: string;
  seats: number;
  image: string;
  gallery: { id: string; label: string; image: string }[];
  stats: { label: string; value: string }[];
  equipments: string[];
  highlights: { title: string; description: string; icon: CarHighlightIcon }[];
  whatsappMessage: string;
};

export const defaultHighlights = [
  {
    title: "Assurance tous risques incluse",
    description: "Roulez sereinement, la couverture premium est incluse dans chaque location.",
    icon: "shield" as const,
  },
  {
    title: "Annulation gratuite",
    description: "Modifiez ou annulez sans frais jusqu'à 48h avant la prise en charge.",
    icon: "refresh" as const,
  },
  {
    title: "Assistance 24/7",
    description: "Notre équipe reste disponible jour et nuit via WhatsApp ou téléphone.",
    icon: "support" as const,
  },
];

export const cars: CarDetail[] = [
  {
    id: "car-logan",
    slug: "dacia-logan",
    brand: "Dacia",
    model: "Logan",
    category: "Citadine pratique",
    description:
      "Idéale pour les trajets quotidiens à Agadir, la Logan offre une faible consommation et un grand coffre.",
    pricePerDay: 200,
    transmission: "Manuelle",
    fuel: "Diesel",
    seats: 5,
    image: carLogan,
    gallery: [
      { id: "logan-main", label: "Profil", image: carLogan },
      { id: "logan-int", label: "Intérieur", image: carLogan },
      { id: "logan-night", label: "Nocturne", image: carLogan },
    ],
    stats: [
      { label: "Transmission", value: "Manuelle" },
      { label: "Carburant", value: "Diesel" },
      { label: "Capacité", value: "5 places" },
    ],
    equipments: [
      "Climatisation automatique",
      "Capteurs de stationnement",
      "Bluetooth + USB",
      "Grand coffre 510L",
      "Régulateur/limitateur",
      "Airbags frontaux et latéraux",
    ],
    highlights: defaultHighlights,
    whatsappMessage: "Bonjour, je souhaite réserver la Dacia Logan.",
  },
  {
    id: "car-clio",
    slug: "renault-clio",
    brand: "Renault",
    model: "Clio",
    category: "Citadine agile",
    description:
      "Compacte, connectée et facile à garer, la Clio est parfaite pour explorer le centre-ville.",
    pricePerDay: 250,
    transmission: "Manuelle",
    fuel: "Essence",
    seats: 5,
    image: carClio,
    gallery: [
      { id: "clio-main", label: "Extérieur", image: carClio },
      { id: "clio-front", label: "Avant", image: carClio },
      { id: "clio-drive", label: "Conduite", image: carClio },
    ],
    stats: [
      { label: "Transmission", value: "Manuelle" },
      { label: "Carburant", value: "Essence" },
      { label: "Capacité", value: "5 places" },
    ],
    equipments: [
      "Caméra de recul",
      'Écran tactile 7"',
      "Apple CarPlay / Android Auto",
      "Allumage auto des feux",
      "Aides au stationnement",
      "Mode Eco pour économies",
    ],
    highlights: defaultHighlights,
    whatsappMessage: "Bonjour, je souhaite réserver la Renault Clio.",
  },
  {
    id: "car-corolla",
    slug: "toyota-corolla",
    brand: "Toyota",
    model: "Corolla",
    category: "Confort urbain",
    description:
      "Berline fiable avec aides à la conduite et consommation réduite pour parcourir la côte en douceur.",
    pricePerDay: 350,
    transmission: "Automatique",
    fuel: "Essence",
    seats: 5,
    image: carCorolla,
    gallery: [
      { id: "corolla-main", label: "Vue 3/4", image: carCorolla },
      { id: "corolla-interior", label: "Intérieur", image: carCorolla },
      { id: "corolla-night", label: "Nuit", image: carCorolla },
    ],
    stats: [
      { label: "Transmission", value: "Automatique" },
      { label: "Carburant", value: "Essence" },
      { label: "Capacité", value: "5 places" },
    ],
    equipments: [
      "Alerte anti-collision",
      "Sellerie tissu premium",
      "Chargeur USB-C",
      "Radar de stationnement",
      "Régulateur adaptatif",
      "Climatisation bi-zone",
    ],
    highlights: defaultHighlights,
    whatsappMessage: "Bonjour, je souhaite réserver la Toyota Corolla.",
  },
  {
    id: "car-golf",
    slug: "volkswagen-golf",
    brand: "Volkswagen",
    model: "Golf",
    category: "Compacte premium",
    description:
      "La compacte iconique avec finition haut de gamme, idéale pour les professionnels exigeants.",
    pricePerDay: 300,
    transmission: "Manuelle",
    fuel: "Diesel",
    seats: 5,
    image: carGolf,
    gallery: [
      { id: "golf-main", label: "Extérieur", image: carGolf },
      { id: "golf-detail", label: "Détails", image: carGolf },
      { id: "golf-night", label: "Nocturne", image: carGolf },
    ],
    stats: [
      { label: "Transmission", value: "Manuelle" },
      { label: "Carburant", value: "Diesel" },
      { label: "Capacité", value: "5 places" },
    ],
    equipments: [
      "Tableau de bord digital",
      "Sièges confort sport",
      "Assistance maintien de voie",
      "Assistant feux de route",
      "Connectivité 4G & Wi-Fi",
      "Toit panoramique",
    ],
    highlights: defaultHighlights,
    whatsappMessage: "Bonjour, je souhaite réserver la Volkswagen Golf.",
  },
  {
    id: "car-tucson",
    slug: "hyundai-tucson",
    brand: "Hyundai",
    model: "Tucson",
    category: "SUV Explorer",
    description:
      "SUV spacieux avec garde au sol élevée et transmission douce pour sortir des sentiers battus.",
    pricePerDay: 450,
    transmission: "Automatique",
    fuel: "Diesel",
    seats: 5,
    image: carTucson,
    gallery: [
      { id: "tucson-main", label: "Vue 3/4", image: carTucson },
      { id: "tucson-interior", label: "Intérieur", image: carTucson },
      { id: "tucson-trail", label: "Off-road", image: carTucson },
    ],
    stats: [
      { label: "Transmission", value: "Automatique" },
      { label: "Traction", value: "Smart AWD" },
      { label: "Capacité", value: "5 places" },
    ],
    equipments: [
      "Toit panoramique",
      "Sièges ventilés",
      "360° Surround View",
      "Coffre électrique",
      "Aides à la descente",
      "Chargeur à induction",
    ],
    highlights: defaultHighlights,
    whatsappMessage: "Bonjour, je souhaite réserver le Hyundai Tucson.",
  },
  {
    id: "car-mercedes",
    slug: "mercedes-classe-c",
    brand: "Mercedes",
    model: "Classe C",
    category: "Premium business",
    description:
      "Intérieur cuir, écran MBUX et suspensions adaptatives pour vos transferts haut de gamme.",
    pricePerDay: 600,
    transmission: "Automatique",
    fuel: "Diesel",
    seats: 5,
    image: carMercedes,
    gallery: [
      { id: "c-main", label: "Extérieur", image: carMercedes },
      { id: "c-dashboard", label: "MBUX", image: carMercedes },
      { id: "c-night", label: "Night Edition", image: carMercedes },
    ],
    stats: [
      { label: "Transmission", value: "Automatique" },
      { label: "Carburant", value: "Diesel" },
      { label: "Capacité", value: "5 places" },
    ],
    equipments: [
      "Intérieur cuir Nappa",
      "Pack conduite semi-autonome",
      "Système Burmester",
      "Ambiance lumineuse 64 couleurs",
      "Sièges chauffants AV",
      "Suspension AIRMATIC",
    ],
    highlights: defaultHighlights,
    whatsappMessage: "Bonjour, je souhaite réserver la Mercedes Classe C.",
  },
];

export const getCarBySlug = (slug: string) => cars.find((car) => car.slug === slug);
