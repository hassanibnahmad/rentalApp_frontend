import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type FormEvent, type ReactNode } from "react";
import {
  CalendarRange,
  ArrowDownRight,
  ArrowUpRight,
  BellRing,
  CalendarDays,
  CarFront,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  CreditCard,
  Clipboard,
  Download,
  Gauge,
  LayoutDashboard,
  FileText,
  Mail,
  Lightbulb,
  ListFilter,
  LogOut,
  MapPin,
  Menu,
  Moon,
  PackageSearch,
  Phone,
  Plus,
  RefreshCcw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Sun,
  Users,
  Wallet,
  Wrench,
  XCircle,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { NavLink, useNavigate } from "react-router-dom";
import * as XLSX from "xlsx-js-style";

import { useAuth } from "@/contexts/AuthContext";
import { useCarInventory } from "@/contexts/CarInventoryContext";
import type { CarDetail } from "@/data/cars";
import { apiClient } from "@/lib/api-client";
import { resolveFriendlyError } from "@/lib/errors";
import { useToast } from "@/components/ui/use-toast";

type ReservationRecord = {
  id: number;
  carId: number;
  status: string;
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string;
  customerPhone: string;
  pickupCity: string;
  pickupDate: string;
  returnCity: string;
  returnDate: string;
  totalAmount: number;
  extras: string[];
  notes?: string | null;
};

type AdminRouteKey =
  | "dashboard"
  | "fleet"
  | "reservations"
  | "customers"
  | "payments"
  | "reports"
  | "settings";

type PaymentProvider = "Stripe" | "PayPal" | "Direct";

type PaymentRecord = {
  id: number;
  reservationId: number;
  customer: string;
  provider: PaymentProvider;
  amount: number;
  currency: string;
  status: "Paid" | "Pending" | "Refunded";
  date: string;
};

type CustomerRecord = {
  name: string;
  email: string;
  phone: string;
  reservations: number;
  spent: number;
  lastVisit: string;
};

type ThemeMode = "dark" | "light";
type SortDirection = "newest" | "oldest";

type FleetWizardStep = 1 | 2 | 3;

type FleetCarForm = {
  brand: string;
  model: string;
  category: string;
  description: string;
  pricePerDay: string;
  transmission: string;
  fuel: string;
  seats: string;
  year: string;
  mileage: string;
  color: string;
  doors: string;
  engine: string;
  licensePlate: string;
  location: string;
  image: string;
  imageSecondary: string;
  imageThird: string;
  imageFourth: string;
  equipmentList: string;
  whatsappMessage: string;
};

const ADMIN_THEME_KEY = "julia-admin-theme";
const ADMIN_ROUTES: Array<{
  key: AdminRouteKey;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  path: string;
}> = [
  { key: "dashboard", label: "Tableau de bord", description: "Vue d'ensemble", icon: LayoutDashboard, path: "/admin/dashboard" },
  { key: "fleet", label: "Flotte / Voitures", description: "Catalogue véhicules", icon: CarFront, path: "/admin/fleet" },
  { key: "reservations", label: "Réservations", description: "Demandes clients", icon: CalendarDays, path: "/admin/reservations" },
  { key: "customers", label: "Clients", description: "Comptes clients", icon: Users, path: "/admin/customers" },
  { key: "payments", label: "Paiements", description: "Encaissements", icon: CircleDollarSign, path: "/admin/payments" },
  { key: "reports", label: "Rapports & indicateurs", description: "KPI et tendances", icon: FileText, path: "/admin/reports" },
  { key: "settings", label: "Paramètres", description: "Préférences", icon: Settings2, path: "/admin/settings" },
];

function BarChartIcon({ className }: { className?: string }) {
  return <BarChart className={className} />;
}

const formatCurrency = (value: number) => new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD", maximumFractionDigits: 0 }).format(value);

const formatDate = (raw: string) => {
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime())
    ? raw
    : parsed.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
};

const formatDateTime = (raw: string) => {
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime())
    ? raw
    : parsed.toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

const formatRate = (value: number) => `${Math.max(0, Math.min(100, Math.round(value)))}%`;

const normalize = (value: string) => value.trim().toLowerCase();

const sortByDate = <T,>(items: T[], getDate: (item: T) => string, direction: SortDirection) =>
  [...items].sort((left, right) => {
    const leftTime = new Date(getDate(left)).getTime();
    const rightTime = new Date(getDate(right)).getTime();
    return direction === "newest" ? rightTime - leftTime : leftTime - rightTime;
  });

const sortByNumeric = <T,>(items: T[], getValue: (item: T) => number, direction: SortDirection) =>
  [...items].sort((left, right) => (direction === "newest" ? getValue(right) - getValue(left) : getValue(left) - getValue(right)));

const createEmptyFleetForm = (car?: CarDetail): FleetCarForm => ({
  brand: car?.brand ?? "",
  model: car?.model ?? "",
  category: car?.category ?? "SUV",
  description: car?.description ?? "",
  pricePerDay: car ? String(car.pricePerDay) : "",
  transmission: car?.transmission ?? "Automatique",
  fuel: car?.fuel ?? "Diesel",
  seats: car ? String(car.seats) : "5",
  year: car?.year ? String(car.year) : "2024",
  mileage: car?.mileage ? String(car.mileage) : "12000",
  color: car?.color ?? "Noir",
  doors: car?.doors ? String(car.doors) : "5",
  engine: car?.engine ?? "2.0L",
  licensePlate: car?.licensePlate ?? "",
  location: car?.location ?? "Agadir",
  image: car?.image ?? "",
  imageSecondary: car?.gallery?.[1]?.image ?? "",
  imageThird: car?.gallery?.[2]?.image ?? "",
  imageFourth: car?.gallery?.[3]?.image ?? "",
  equipmentList: car?.equipments?.join("\n") ?? "",
  whatsappMessage: car?.whatsappMessage ?? "",
});

const parseEquipmentList = (value: string) =>
  value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);

const createGallery = (slug: string, sources: string[]) => {
  const images = sources.filter(Boolean);
  const fallback = images[0] ?? "";
  const labels = ["Exterior", "Interior", "Gallery", "Detail"];

  return labels.map((label, index) => ({
    id: `${slug}-image-${index}`,
    label,
    image: images[index] ?? fallback,
  }));
};

const buildFleetCarRecord = (form: FleetCarForm, existing?: CarDetail): CarDetail => {
  const brand = form.brand.trim();
  const model = form.model.trim();
  const slug = `${brand}-${model}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const mainImage = form.image.trim();
  const gallery = createGallery(slug, [mainImage, form.imageSecondary.trim(), form.imageThird.trim(), form.imageFourth.trim()]);
  const seats = Number(form.seats) || 5;
  const pricePerDay = Number(form.pricePerDay) || 0;
  const year = Number(form.year) || new Date().getFullYear();
  const mileage = Number(form.mileage) || 0;
  const doors = Number(form.doors) || 5;
  const equipments = parseEquipmentList(form.equipmentList);
  const description = form.description.trim() || `${brand} ${model} is ready for premium rental operations.`;

  return {
    id: existing?.id ?? `draft-${Date.now()}`,
    remoteId: existing?.remoteId,
    slug,
    brand,
    model,
    category: form.category.trim() || "Sans catégorie",
    description,
    pricePerDay,
    transmission: form.transmission.trim() || "Automatique",
    fuel: form.fuel.trim() || "Diesel",
    seats,
    image: mainImage,
    gallery,
    stats: [
      { label: "Transmission", value: form.transmission.trim() || "Automatique" },
      { label: "Carburant", value: form.fuel.trim() || "Diesel" },
      { label: "Capacité", value: `${seats} places` },
      { label: "Année", value: String(year) },
      { label: "Kilométrage", value: `${mileage.toLocaleString("fr-FR")} km` },
    ],
    equipments:
      equipments.length > 0
        ? equipments
        : ["Climatisation automatique", "Bluetooth", "Assistance 24/7"],
    highlights:
      existing?.highlights ?? [
        {
          title: "Assurance tous risques incluse",
          description: "Roulez sereinement avec une couverture premium.",
          icon: "shield" as const,
        },
        {
          title: "Annulation gratuite",
          description: "Flexible jusqu'à 48h avant la prise en charge.",
          icon: "refresh" as const,
        },
        {
          title: "Assistance 24/7",
          description: "Support disponible à tout moment.",
          icon: "support" as const,
        },
      ],
    whatsappMessage:
      form.whatsappMessage.trim() || `Bonjour, je souhaite réserver la ${brand} ${model}.`,
    year,
    mileage,
    color: form.color.trim() || "Noir",
    doors,
    engine: form.engine.trim() || "2.0L",
    licensePlate: form.licensePlate.trim(),
    location: form.location.trim() || "Agadir",
  };
};

const parseDateInput = (raw: string) => {
  if (!raw) {
    return null;
  }
  const parsed = new Date(`${raw}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isBetweenDates = (candidate: string, start: string, end: string) => {
  const parsed = parseDateInput(candidate);
  if (!parsed) {
    return false;
  }
  const startDate = parseDateInput(start);
  const endDate = parseDateInput(end);
  if (startDate && parsed < startDate) {
    return false;
  }
  if (endDate && parsed > endDate) {
    return false;
  }
  return true;
};

const extractReservationTotal = (reservation: ReservationRecord) => {
  if (typeof reservation.totalAmount === "number") {
    return reservation.totalAmount;
  }
  const match = reservation.notes?.match(/(\d+(?:[.,]\d+)?)/);
  return match ? Number(match[1].replace(",", ".")) : 0;
};

const normalizePhoneToWhatsapp = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  if (!digits) {
    return "";
  }
  return digits.startsWith("212") ? digits : `212${digits.replace(/^0+/, "")}`;
};

const getReservationStatusBadge = (status: string) => {
  switch (status) {
    case "CONFIRMED":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
    case "CANCELLED":
      return "border-rose-500/30 bg-rose-500/10 text-rose-200";
    case "PENDING_PAYMENT":
      return "border-amber-500/30 bg-amber-500/10 text-amber-200";
    default:
      return "border-slate-500/30 bg-slate-500/10 text-slate-200";
  }
};

const getCarAvailability = (car: CarDetail, reservations: ReservationRecord[]) => {
  const now = Date.now();
  const active = reservations.some((reservation) => {
    if (reservation.carId !== (car.remoteId ?? -1)) {
      return false;
    }
    if (reservation.status === "CANCELLED") {
      return false;
    }
    const pickup = parseDateInput(reservation.pickupDate)?.getTime() ?? 0;
    const returnDate = parseDateInput(reservation.returnDate)?.getTime() ?? 0;
    return pickup <= now && returnDate >= now;
  });
  const reservedSoon = reservations.some((reservation) => {
    if (reservation.carId !== (car.remoteId ?? -1) || reservation.status === "CANCELLED") {
      return false;
    }
    const pickup = parseDateInput(reservation.pickupDate)?.getTime() ?? 0;
    return pickup > now;
  });

  if (active) {
    return { key: "rented", label: "Louée", className: "border-blue-500/30 bg-blue-500/10 text-blue-200" };
  }
  if (reservedSoon) {
    return { key: "reserved", label: "Réservée", className: "border-amber-500/30 bg-amber-500/10 text-amber-200" };
  }
  return { key: "available", label: "Disponible", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" };
};

const useReservations = () => {
  const [reservations, setReservations] = useState<ReservationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReservations = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      const { data } = await apiClient.get<ReservationRecord[]>("/reservations");
      setReservations(data);
      setError(null);
    } catch (fetchError) {
      console.error("Impossible de charger les réservations", fetchError);
      setError("Impossible de charger les réservations.");
      setReservations([]);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchReservations();
    const timer = window.setInterval(() => {
      void fetchReservations(true);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [fetchReservations]);

  return { reservations, loading, error, refresh: fetchReservations, setReservations };
};

const useAdminTheme = () => {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") {
      return "dark";
    }
    return window.localStorage.getItem(ADMIN_THEME_KEY) === "light" ? "light" : "dark";
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(ADMIN_THEME_KEY, theme);
    document.documentElement.dataset.adminTheme = theme;
  }, [theme]);

  return { theme, setTheme, isDark: theme === "dark" };
};

const SectionShell = ({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) => (
  <section className="rounded-[28px] border border-white/10 bg-[#111827] p-5 shadow-[0_20px_60px_rgba(3,7,18,0.55)] md:p-6">
    <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.35em] text-slate-400">{description}</p>
        <h2 className="mt-1 text-2xl font-semibold text-slate-50 md:text-[1.75rem]">{title}</h2>
      </div>
      {action}
    </div>
    {children}
  </section>
);

const SortDropdown = ({
  value,
  onChange,
}: {
  value: SortDirection;
  onChange: (value: SortDirection) => void;
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const options: Array<{ value: SortDirection; label: string }> = [
    { value: "newest", label: "Plus récentes d'abord" },
    { value: "oldest", label: "Plus anciennes d'abord" },
  ];

  return (
    <div ref={rootRef} className="relative inline-flex justify-end">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-200 transition hover:bg-white/10"
        aria-label="Trier"
        title={value === "newest" ? "Plus récentes d'abord" : "Plus anciennes d'abord"}
      >
        <ListFilter className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-20 min-w-52 overflow-hidden rounded-2xl border border-white/10 bg-[#0f172a] shadow-[0_20px_60px_rgba(3,7,18,0.55)]">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`block w-full px-4 py-3 text-left text-sm transition hover:bg-white/5 ${value === option.value ? "text-white" : "text-slate-300"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const MetricCard = ({
  label,
  value,
  delta,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: string;
  delta: string;
  icon: typeof ShieldCheck;
  tone?: "primary" | "success" | "warning" | "danger";
}) => {
  const toneClass =
    tone === "success"
      ? "from-emerald-500/20 to-emerald-500/0 text-emerald-300"
      : tone === "warning"
        ? "from-amber-500/20 to-amber-500/0 text-amber-300"
        : tone === "danger"
          ? "from-rose-500/20 to-rose-500/0 text-rose-300"
          : "from-blue-500/20 to-blue-500/0 text-blue-300";

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/8 to-white/0 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">{label}</p>
          <p className="mt-3 text-3xl font-semibold text-slate-50">{value}</p>
          <p className="mt-2 text-xs text-slate-400">{delta}</p>
        </div>
        <div className={`rounded-2xl bg-gradient-to-br p-3 ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
};

const EmptyState = ({ title, description }: { title: string; description: string }) => (
  <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-6 text-center text-slate-400">
    <p className="text-base font-medium text-slate-200">{title}</p>
    <p className="mt-1 text-sm text-slate-400">{description}</p>
  </div>
);

const ModalShell = ({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-8 backdrop-blur-sm">
    <div className="modal-scrollbar max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[28px] border border-white/10 bg-[#0f172a] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.55)] md:p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-slate-50">{title}</h3>
          {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-200 transition hover:bg-white/10"
        >
          <XCircle className="h-5 w-5" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const DetailCard = ({
  icon: Icon,
  label,
  value,
  subvalue,
  href,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subvalue?: string;
  href?: string;
}) => {
  const content = (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-slate-400" />
        <p className="text-xs uppercase tracking-[0.35em] text-slate-500">{label}</p>
      </div>
      <p className="mt-3 break-words text-sm text-slate-100">{value}</p>
      {subvalue && <p className="mt-1 text-xs text-slate-400">{subvalue}</p>}
    </div>
  );

  if (!href) {
    return content;
  }

  return (
    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noreferrer" : undefined} className="block transition hover:scale-[1.01]">
      {content}
    </a>
  );
};

export const AdminShell = ({ children }: { children: ReactNode }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { theme, setTheme } = useAdminTheme();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-[#0b1220] text-slate-100">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[260px] border-r border-white/10 bg-[#0f172a] px-4 py-5 shadow-[0_20px_80px_rgba(0,0,0,0.35)] transition-transform duration-300 lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <div className="flex h-full flex-col">
          <div className="mb-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.4em] text-slate-400">Julia Auto Cars</p>
            <p className="mt-2 text-xl font-semibold text-slate-50">Admin Command</p>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
            {ADMIN_ROUTES.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.key}
                  to={item.path}
                  end={item.key === "dashboard"}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    [
                      "flex items-center gap-3 rounded-2xl px-3 py-3 transition",
                      isActive
                        ? "border border-blue-500/25 bg-blue-500/10 text-blue-200"
                        : "border border-transparent text-slate-300 hover:border-white/10 hover:bg-white/5",
                    ].join(" ")
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{item.label}</span>
                    <span className="block text-xs text-slate-500">{item.description}</span>
                  </span>
                </NavLink>
              );
            })}
          </nav>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Connected</p>
            <p className="mt-2 font-medium text-slate-50">{user?.name ?? user?.email ?? "Admin User"}</p>
            <p className="text-xs text-slate-400">Role: {user?.role?.toUpperCase() ?? "ADMIN"}</p>
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/60 lg:hidden"
        />
      )}

      <div className="min-h-screen lg:pl-[260px]">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0b1220]/95 px-4 py-3 backdrop-blur-xl md:px-6">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen((value) => !value)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-100 transition hover:bg-white/10 lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="relative w-full max-w-[460px]">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Rechercher n'importe quoi..."
                  className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 pl-11 pr-4 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-blue-500/40"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-slate-200 transition hover:bg-white/10"
              >
                <BellRing className="h-4 w-4" />
                <span className="hidden sm:inline">Notifications</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-slate-200 transition hover:bg-white/10"
              >
                {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                <span className="hidden sm:inline">{theme === "dark" ? "Dark" : "Light"}</span>
              </button>
              
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 text-sm font-medium text-rose-200 transition hover:bg-rose-500/15"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </div>
        </header>

        <main className="w-full px-4 py-4 md:px-6 md:py-5">{children}</main>
      </div>
    </div>
  );
};

export const AdminDashboardPage = () => {
  const navigate = useNavigate();
  const { cars } = useCarInventory();
  const { reservations, loading, error } = useReservations();
  const [windowSize, setWindowSize] = useState<7 | 30 | 90>(7);

  const analytics = useMemo(() => {
    const now = Date.now();
    const activeStatuses = new Set(["CONFIRMED", "PENDING_PAYMENT"]);
    const upcomingStatuses = new Set(["CONFIRMED", "PENDING_PAYMENT"]);
    const carByRemoteId = new Map(cars.map((car) => [car.remoteId ?? -1, car]));
    const totals = reservations.reduce(
      (acc, reservation) => {
        const amount = extractReservationTotal(reservation);
        acc.revenue += amount;
        if (reservation.status === "CANCELLED") {
          acc.cancelled += 1;
        }
        if (reservation.status === "CONFIRMED") {
          acc.confirmed += 1;
        }
        if (reservation.status === "PENDING_PAYMENT") {
          acc.pending += 1;
        }
        if (new Date(reservation.pickupDate).getTime() >= now) {
          acc.upcoming += 1;
        }
        if (activeStatuses.has(reservation.status)) {
          acc.active += amount;
        }
        return acc;
      },
      { revenue: 0, cancelled: 0, confirmed: 0, pending: 0, upcoming: 0, active: 0 }
    );

    const fleetCounts = cars.reduce(
      (acc, car) => {
        const availability = getCarAvailability(car, reservations).key;
        if (availability === "available") {
          acc.available += 1;
        }
        if (availability === "reserved") {
          acc.reserved += 1;
        }
        if (availability === "rented") {
          acc.rented += 1;
        }
        return acc;
      },
      { available: 0, reserved: 0, rented: 0 }
    );

    const fleetStatus = [
      { label: "Disponible", value: fleetCounts.available, color: "#22c55e" },
      { label: "Réservée", value: fleetCounts.reserved, color: "#f59e0b" },
      { label: "Louée", value: fleetCounts.rented, color: "#3b82f6" },
    ];

    const topCars = [...cars]
      .map((car) => ({
        car,
        bookings: reservations.filter((reservation) => reservation.carId === (car.remoteId ?? -1)).length,
        revenue: reservations.filter((reservation) => reservation.carId === (car.remoteId ?? -1)).reduce((sum, reservation) => sum + extractReservationTotal(reservation), 0),
      }))
      .sort((left, right) => right.bookings - left.bookings)
      .slice(0, 4);
      const sortedByPickup = [...reservations].sort((a, b) => new Date(a.pickupDate).getTime() - new Date(b.pickupDate).getTime());

      const series = (() => {
        const out: Array<{ label: string; revenue: number }> = [];
        for (let i = windowSize - 1; i >= 0; i--) {
          const day = new Date();
          day.setDate(day.getDate() - i);
          const label = day.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
          const revenue = reservations.reduce((sum, r) => {
            const d = new Date(r.pickupDate);
            if (d.getFullYear() === day.getFullYear() && d.getMonth() === day.getMonth() && d.getDate() === day.getDate()) {
              return sum + extractReservationTotal(r);
            }
            return sum;
          }, 0);
          out.push({ label, revenue });
        }
        return out;
      })();

      const recentBookings = sortedByPickup.slice(-4).reverse();
    const upcomingReservations = [...reservations]
        .filter((reservation) => reservation.status !== "CANCELLED" && (parseDateInput(reservation.pickupDate)?.getTime() ?? 0) >= now)
      .sort((left, right) => new Date(left.pickupDate).getTime() - new Date(right.pickupDate).getTime())
      .slice(0, 5);

      const busiestPickupDay = (() => {
        if (reservations.length === 0) {
          return "—";
        }
        const labels = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
        const counts = reservations.reduce((acc, reservation) => {
          const date = new Date(reservation.pickupDate);
          if (Number.isNaN(date.getTime())) {
            return acc;
          }
          acc[date.getDay()] += 1;
          return acc;
        }, [0, 0, 0, 0, 0, 0, 0]);
        const maxIndex = counts.indexOf(Math.max(...counts));
        return labels[maxIndex] ?? "—";
      })();

      const averageRentalDurationDays = (() => {
        const activeOrFinished = reservations.filter((reservation) => reservation.status !== "CANCELLED");
        if (activeOrFinished.length === 0) {
          return 0;
        }
        const totalDays = activeOrFinished.reduce((sum, reservation) => {
          const pickup = parseDateInput(reservation.pickupDate)?.getTime() ?? 0;
          const dropoff = parseDateInput(reservation.returnDate)?.getTime() ?? pickup;
          const days = Math.max(1, Math.round((dropoff - pickup) / (1000 * 60 * 60 * 24)));
          return sum + days;
        }, 0);
        return totalDays / activeOrFinished.length;
      })();

      const mostRentedBrand = (() => {
        const brandCounts = new Map<string, number>();
        reservations.forEach((reservation) => {
          if (reservation.status === "CANCELLED") {
            return;
          }
          const car = carByRemoteId.get(reservation.carId);
          if (!car) {
            return;
          }
          brandCounts.set(car.brand, (brandCounts.get(car.brand) ?? 0) + 1);
        });
        const ranked = [...brandCounts.entries()].sort((a, b) => b[1] - a[1]);
        return ranked[0]?.[0] ?? "—";
      })();

      return {
        totals,
        series,
        fleetStatus,
        fleetCounts,
        topCars,
        recentBookings,
        upcomingReservations,
        busiestPickupDay,
        averageRentalDurationDays,
        mostRentedBrand,
      };
  }, [cars, reservations, windowSize]);

  const dailyTrend = useMemo(() => {
    if (analytics.series.length < 2) {
      return 0;
    }
    const recent = analytics.series.at(-1)?.revenue ?? 0;
    const previous = analytics.series.at(-2)?.revenue ?? 0;
    if (previous === 0) {
      return recent > 0 ? 100 : 0;
    }
    return ((recent - previous) / previous) * 100;
  }, [analytics.series]);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-5">
        <MetricCard label="Chiffre d'affaires" value={formatCurrency(analytics.totals.revenue)} delta="Synchronisé depuis les réservations" icon={Wallet} tone="primary" />
        <MetricCard label="Réservations" value={String(reservations.length)} delta={`${analytics.totals.confirmed} confirmées / ${analytics.totals.pending} en attente`} icon={CalendarDays} tone="success" />
        <MetricCard label="Occupation flotte" value={formatRate(((analytics.fleetCounts.reserved + analytics.fleetCounts.rented) / Math.max(cars.length, 1)) * 100)} delta="Part réservée ou louée" icon={Gauge} tone="warning" />
        <MetricCard label="Locations actives" value={String(analytics.fleetCounts.rented)} delta={`${analytics.fleetCounts.reserved} réservations à venir`} icon={CreditCard} tone="primary" />
        <MetricCard label="Taux d'annulation" value={formatRate((analytics.totals.cancelled / Math.max(reservations.length, 1)) * 100)} delta={`${dailyTrend >= 0 ? "+" : ""}${dailyTrend.toFixed(1)}% vs la veille`} icon={XCircle} tone="danger" />
      </div>

      {error && <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{error}</div>}

      <div className="grid gap-5 xl:grid-cols-[1.6fr,1fr]">
        <SectionShell title="Aperçu des revenus" description="Tendance sur 7 / 30 / 90 jours" action={
          <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1 text-xs text-slate-300">
            {[7, 30, 90].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setWindowSize(value as 7 | 30 | 90)}
                className={`rounded-full px-3 py-1.5 transition ${windowSize === value ? "bg-blue-500 text-white" : "hover:bg-white/10"}`}
              >
                {value} jours
              </button>
            ))}
          </div>
        }>
          <div className="h-[330px] w-full">
            <ResponsiveContainer>
              <LineChart data={analytics.series} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="rgba(148,163,184,0.14)" />
                <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
                  contentStyle={{ background: "rgba(15,23,42,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16 }}
                />
                <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionShell>

        <SectionShell title="État de la flotte" description="Répartition en direct" action={
          <button type="button" className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10">
            <PackageSearch className="h-4 w-4" />
            Voir la flotte
          </button>
        }>
          <div className="grid gap-4 lg:grid-cols-[220px,1fr] lg:items-center">
            <div className="h-[240px] w-full">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={analytics.fleetStatus} dataKey="value" nameKey="label" innerRadius={62} outerRadius={88} paddingAngle={4}>
                    {analytics.fleetStatus.map((entry) => (
                      <Cell key={entry.label} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => String(value)} contentStyle={{ background: "rgba(15,23,42,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {analytics.fleetStatus.map((entry) => (
                <div key={entry.label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-sm text-slate-200">{entry.label}</span>
                  </div>
                  <span className="text-sm text-slate-400">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        </SectionShell>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <SectionShell title="Réservations à venir" description="File opérationnelle" action={<button className="text-sm text-blue-300 hover:text-blue-200" type="button">Tout voir</button>}>
          <div className="space-y-3">
            {analytics.upcomingReservations.length === 0 ? (
              <EmptyState title="Aucune réservation à venir" description="Les nouvelles réservations apparaîtront ici en temps réel." />
            ) : (
              analytics.upcomingReservations.map((reservation) => (
                <div key={reservation.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-50">{reservation.customerFirstName} {reservation.customerLastName}</p>
                      <p className="text-sm text-slate-400">{reservation.pickupCity} • {formatDate(reservation.pickupDate)}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.3em] ${getReservationStatusBadge(reservation.status)}`}>{reservation.status}</span>
                  </div>
                  <p className="mt-3 text-xs text-slate-400">{reservation.customerEmail}</p>
                </div>
              ))
            )}
          </div>
        </SectionShell>

        <SectionShell title="Réservations récentes" description="Dernière activité" action={<button className="text-sm text-blue-300 hover:text-blue-200" type="button">Tout voir</button>}>
          <div className="space-y-3">
            {analytics.recentBookings.length === 0 ? (
              <EmptyState title="Aucune réservation pour l'instant" description="L'activité de réservation s'affichera ici." />
            ) : (
              analytics.recentBookings.map((reservation) => (
                <div key={reservation.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div>
                    <p className="font-medium text-slate-50">{reservation.customerFirstName} {reservation.customerLastName}</p>
                    <p className="text-sm text-slate-400">{reservation.pickupCity} • {formatDate(reservation.pickupDate)}</p>
                  </div>
                  <span className="text-sm text-emerald-300">{formatCurrency(extractReservationTotal(reservation))}</span>
                </div>
              ))
            )}
          </div>
        </SectionShell>

        <SectionShell title="Voitures les plus performantes" description="Véhicules les plus loués" action={<button className="text-sm text-blue-300 hover:text-blue-200" type="button">Ouvrir la flotte</button>}>
          <div className="space-y-3">
            {analytics.topCars.length === 0 ? (
              <EmptyState title="Aucun véhicule trouvé" description="Votre flotte est vide ou encore en synchronisation." />
            ) : (
              analytics.topCars.map(({ car, bookings, revenue }) => (
                <div key={car.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="font-medium text-slate-50">{car.brand} {car.model}</p>
                  <p className="text-sm text-slate-400">{bookings} réservations • {formatCurrency(revenue)}</p>
                </div>
              ))
            )}
          </div>
        </SectionShell>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.4fr,0.9fr]">
        <SectionShell title="Actions rapides" description="Raccourcis opérationnels">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[
              { label: "Les voitures", icon: CarFront, tone: "bg-blue-500/15 text-blue-200", to: "/admin/fleet" },
              { label: "Les réservations", icon: CalendarDays, tone: "bg-emerald-500/15 text-emerald-200", to: "/admin/reservations" },
              { label: "Les clients", icon: Users, tone: "bg-violet-500/15 text-violet-200", to: "/admin/customers" },
              { label: "Rapports", icon: BarChartIcon, tone: "bg-cyan-500/15 text-cyan-200", to: "/admin/reports" },
              { label: "Paramètres", icon: Settings2, tone: "bg-slate-500/15 text-slate-200", to: "/admin/settings" },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <button key={action.label} type="button" onClick={() => navigate(action.to)} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-left transition hover:bg-white/8">
                  <span className={`rounded-2xl px-3 py-3 ${action.tone}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-medium text-slate-100">{action.label}</span>
                </button>
              );
            })}
          </div>
        </SectionShell>

        <SectionShell title="Indicateurs" description="Signaux de gestion">
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-100">Jour de réservation le plus chargé</p>
                <p className="text-xs text-slate-400">Plus fort flux de réservations cette semaine</p>
              </div>
              <span className="text-sm text-slate-200">{analytics.busiestPickupDay}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-100">Durée moyenne de location</p>
                <p className="text-xs text-slate-400">Estimée à partir des commandes actives</p>
              </div>
              <span className="text-sm text-slate-200">{analytics.averageRentalDurationDays.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} jours</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-100">Marque la plus louée</p>
                <p className="text-xs text-slate-400">Basée sur les réservations finalisées</p>
              </div>
              <span className="text-sm text-slate-200">{analytics.mostRentedBrand}</span>
            </div>
          </div>
          {loading && <p className="mt-4 text-xs text-slate-500">Refreshing live metrics...</p>}
        </SectionShell>
      </div>
    </div>
  );
};

export const AdminFleetPage = () => {
  const { cars, addCar, updateCar, deleteCar } = useCarInventory();
  const { reservations } = useReservations();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selectedAvailability, setSelectedAvailability] = useState<"all" | "available" | "reserved" | "rented">("all");
  const [fleetSort, setFleetSort] = useState<SortDirection>("newest");
  const [editingCar, setEditingCar] = useState<CarDetail | null>(null);
  const [fleetModalOpen, setFleetModalOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<FleetWizardStep>(1);
  const [form, setForm] = useState<FleetCarForm>(() => createEmptyFleetForm());
  const [busy, setBusy] = useState(false);

  const filteredCars = useMemo(() => {
    return cars.filter((car) => {
      const haystack = `${car.brand} ${car.model} ${car.category}`.toLowerCase();
      if (search && !haystack.includes(normalize(search))) {
        return false;
      }
      const availability = getCarAvailability(car, reservations).key;
      if (selectedAvailability !== "all" && availability !== selectedAvailability) {
        return false;
      }
      return true;
    });
  }, [cars, reservations, search, selectedAvailability]);

  const sortedCars = useMemo(() => sortByNumeric(filteredCars, (car) => car.remoteId ?? 0, fleetSort), [filteredCars, fleetSort]);

  const openCreate = () => {
    setEditingCar(null);
    setForm(createEmptyFleetForm());
    setWizardStep(1);
    setFleetModalOpen(true);
  };

  const openEdit = (car: CarDetail) => {
    setEditingCar(car);
    setForm(createEmptyFleetForm(car));
    setWizardStep(1);
    setFleetModalOpen(true);
  };

  const canAdvanceStepOne = form.brand.trim().length > 0 && form.model.trim().length > 0 && form.image.trim().length > 0;
  const canAdvanceStepTwo = form.description.trim().length > 0 && form.pricePerDay.trim().length > 0;
  const previewImages = [form.image.trim(), form.imageSecondary.trim(), form.imageThird.trim(), form.imageFourth.trim()].filter(Boolean);
  const previewCar = buildFleetCarRecord(form, editingCar ?? undefined);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    try {
      const payload = buildFleetCarRecord(form, editingCar ?? undefined);
      if (editingCar?.remoteId) {
        await updateCar(editingCar.remoteId, payload);
        toast({ title: "Voiture mise à jour", description: `${payload.brand} ${payload.model} a été enregistrée.` });
      } else {
        await addCar(payload);
        toast({ title: "Voiture ajoutée", description: `${payload.brand} ${payload.model} fait maintenant partie de la flotte.` });
      }
      setEditingCar(null);
      setFleetModalOpen(false);
      setWizardStep(1);
      setForm(createEmptyFleetForm());
    } catch (error) {
      toast({ title: "Unable to save car", description: resolveFriendlyError(error), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (car: CarDetail) => {
    if (!car.remoteId) {
      return;
    }
    setBusy(true);
    try {
      await deleteCar(car.remoteId);
      toast({ title: "Car deleted", description: `${car.brand} ${car.model} removed from the fleet.` });
    } catch (error) {
      toast({ title: "Unable to delete car", description: resolveFriendlyError(error), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <SectionShell
        title="Fleet Management"
        description="CRUD et disponibilité"
        action={<button onClick={openCreate} type="button" className="inline-flex items-center gap-2 rounded-2xl bg-blue-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-400"><Plus className="h-4 w-4" />Ajouter une voiture</button>}
      >
        <div className="grid gap-3 md:grid-cols-[1.2fr,0.8fr,0.8fr,0.8fr]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 flex flex-row items-center gap-3 justify-between">
            <Search className="h-4 w-4 text-slate-500" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher par marque, modèle ou catégorie" className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500" />
          </div>
          <select value={selectedAvailability} onChange={(event) => setSelectedAvailability(event.target.value as typeof selectedAvailability)} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-100 outline-none ">
            <option value="all">Toutes les disponibilités</option>
            <option value="available">Disponible</option>
            <option value="reserved">Réservée</option>
            <option value="rented">Louée</option>
          </select>          
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">{filteredCars.length} véhicule(s) affiché(s)</div>

          <SortDropdown value={fleetSort} onChange={setFleetSort} />
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-left text-sm">
              <thead className="bg-white/[0.04] text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">
                    <span className="inline-flex items-center gap-2"><CarFront className="h-4 w-4 text-slate-400" />Voiture</span>
                  </th>
                  <th className="px-4 py-3 font-medium">
                    <span className="inline-flex items-center gap-2"><ListFilter className="h-4 w-4 text-slate-400" />Catégorie</span>
                  </th>
                  <th className="px-4 py-3 font-medium">
                    <span className="inline-flex items-center gap-2"><CircleDollarSign className="h-4 w-4 text-slate-400" />Prix</span>
                  </th>
                  <th className="px-4 py-3 font-medium">
                    <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-slate-400" />Statut</span>
                  </th>
                  <th className="px-4 py-3 font-medium">
                    <span className="inline-flex items-center gap-2"><Wrench className="h-4 w-4 text-slate-400" />Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-[#0f172a]">
                {filteredCars.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10">
                      <EmptyState title="Aucune voiture ne correspond à vos filtres" description="Essayez une autre marque ou un autre état de disponibilité." />
                    </td>
                  </tr>
                ) : (
                  sortedCars.map((car) => {
                    const availability = getCarAvailability(car, reservations);
                    return (
                      <tr key={car.id} className="align-top hover:bg-white/[0.03]">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <img src={car.image} alt={`${car.brand} ${car.model}`} className="h-14 w-20 rounded-xl object-cover" />
                            <div>
                              <p className="font-medium text-slate-50">{car.brand} {car.model}</p>
                              <p className="text-xs text-slate-400">{car.slug}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-slate-300">{car.category}</td>
                        <td className="px-4 py-4 text-slate-200">{formatCurrency(car.pricePerDay)}</td>
                        <td className="px-4 py-4"><span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.25em] ${availability.className}`}>{availability.label}</span></td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => openEdit(car)} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-200 transition hover:bg-white/10">Modifier</button>
                            <button type="button" disabled={busy} onClick={() => void handleDelete(car)} className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200 transition hover:bg-rose-500/20">Supprimer</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </SectionShell>

      {fleetModalOpen ? (
        <ModalShell
          title={editingCar ? "Modifier la voiture" : "Ajouter une voiture"}
          description="Assistant en trois étapes avec toutes les informations du véhicule et des aperçus en direct."
          onClose={() => {
            setEditingCar(null);
            setFleetModalOpen(false);
            setWizardStep(1);
          }}
        >
          <form onSubmit={(event) => void handleSave(event)} className="space-y-5">
            <div className="grid gap-3 md:grid-cols-3">
              {[
                { step: 1 as const, label: "Bases", icon: SlidersHorizontal, done: canAdvanceStepOne },
                { step: 2 as const, label: "Détails", icon: Wrench, done: canAdvanceStepTwo },
                { step: 3 as const, label: "Images", icon: CheckCircle2, done: previewImages.length > 0 },
              ].map((item) => {
                const Icon = item.icon;
                const active = wizardStep === item.step;
                return (
                  <button
                    key={item.step}
                    type="button"
                    onClick={() => setWizardStep(item.step)}
                    className={`rounded-2xl border px-4 py-3 text-left transition ${
                      active
                        ? "border-blue-500/30 bg-blue-500/10"
                        : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full p-2 ${item.done ? "bg-emerald-500/15 text-emerald-200" : active ? "bg-blue-500/15 text-blue-200" : "bg-white/5 text-slate-400"}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-slate-50">{item.label}</p>
                        <p className="text-xs text-slate-400">Étape {item.step} sur 3</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {wizardStep === 1 && (
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span className="text-slate-300">Marque</span>
                  <input value={form.brand} onChange={(event) => setForm((value) => ({ ...value, brand: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-slate-100 outline-none" required />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="text-slate-300">Modèle</span>
                  <input value={form.model} onChange={(event) => setForm((value) => ({ ...value, model: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-slate-100 outline-none" required />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="text-slate-300">Catégorie</span>
                  <input value={form.category} onChange={(event) => setForm((value) => ({ ...value, category: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-slate-100 outline-none" />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="text-slate-300">Places</span>
                  <input type="number" min="2" max="9" value={form.seats} onChange={(event) => setForm((value) => ({ ...value, seats: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-slate-100 outline-none" />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="text-slate-300">Année</span>
                  <input type="number" min="1990" max="2035" value={form.year} onChange={(event) => setForm((value) => ({ ...value, year: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-slate-100 outline-none" />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="text-slate-300">Kilométrage</span>
                  <input type="number" min="0" value={form.mileage} onChange={(event) => setForm((value) => ({ ...value, mileage: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-slate-100 outline-none" />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="text-slate-300">Couleur</span>
                  <input value={form.color} onChange={(event) => setForm((value) => ({ ...value, color: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-slate-100 outline-none" placeholder="Noir, Blanc, Gris..." />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="text-slate-300">Portes</span>
                  <input type="number" min="2" max="6" value={form.doors} onChange={(event) => setForm((value) => ({ ...value, doors: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-slate-100 outline-none" />
                </label>
                <label className="space-y-2 text-sm lg:col-span-2">
                  <span className="text-slate-300">URL de l'image principale</span>
                  <input value={form.image} onChange={(event) => setForm((value) => ({ ...value, image: event.target.value }))} placeholder="https://..." className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-slate-100 outline-none" required />
                </label>
                <div className="lg:col-span-2 flex justify-between gap-3">
                  <p className="text-xs text-slate-500"></p>
                  <button type="button" onClick={() => setWizardStep(2)} disabled={!canAdvanceStepOne} className="rounded-2xl bg-blue-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-400 disabled:opacity-40">Suivant</button>
                </div>
              </div>
            )}

            {wizardStep === 2 && (
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="space-y-2 text-sm lg:col-span-2">
                  <span className="text-slate-300">Description</span>
                  <textarea value={form.description} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} rows={4} className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-slate-100 outline-none" placeholder="Rédigez une description soignée pour l'annonce du véhicule." />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="text-slate-300">Prix par jour</span>
                  <input type="number" min="0" value={form.pricePerDay} onChange={(event) => setForm((value) => ({ ...value, pricePerDay: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-slate-100 outline-none" required />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="text-slate-300">Transmission</span>
                  <select value={form.transmission} onChange={(event) => setForm((value) => ({ ...value, transmission: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-slate-100 outline-none">
                    <option value="Automatique">Automatique</option>
                    <option value="Manuelle">Manuelle</option>
                    <option value="Semi-automatique">Semi-automatique</option>
                  </select>
                </label>
                <label className="space-y-2 text-sm">
                  <span className="text-slate-300">Carburant</span>
                  <select value={form.fuel} onChange={(event) => setForm((value) => ({ ...value, fuel: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-slate-100 outline-none">
                    <option value="Diesel">Diesel</option>
                    <option value="Essence">Essence</option>
                    <option value="Hybride">Hybride</option>
                    <option value="Électrique">Électrique</option>
                  </select>
                </label>
                <label className="space-y-2 text-sm">
                  <span className="text-slate-300">Moteur</span>
                  <input value={form.engine} onChange={(event) => setForm((value) => ({ ...value, engine: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-slate-100 outline-none" placeholder="2.0L / V6 / Électrique" />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="text-slate-300">Immatriculation</span>
                  <input value={form.licensePlate} onChange={(event) => setForm((value) => ({ ...value, licensePlate: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-slate-100 outline-none" placeholder="AA-123-BB" />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="text-slate-300">Localisation</span>
                  <input value={form.location} onChange={(event) => setForm((value) => ({ ...value, location: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-slate-100 outline-none" placeholder="Agadir, Marrakech..." />
                </label>
                <label className="space-y-2 text-sm lg:col-span-2">
                  <span className="text-slate-300">WhatsApp message</span>
                  <input value={form.whatsappMessage} onChange={(event) => setForm((value) => ({ ...value, whatsappMessage: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-slate-100 outline-none" placeholder="Réponse WhatsApp par défaut pour ce véhicule" />
                </label>
                <label className="space-y-2 text-sm lg:col-span-2">
                  <span className="text-slate-300">Equipment list</span>
                  <textarea value={form.equipmentList} onChange={(event) => setForm((value) => ({ ...value, equipmentList: event.target.value }))} rows={5} className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-slate-100 outline-none" placeholder="Un équipement par ligne, ex.\nBluetooth\nClimatisation automatique\nCaméra de recul" />
                </label>
                <div className="lg:col-span-2 flex justify-between gap-3">
                  <button type="button" onClick={() => setWizardStep(1)} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-200">Retour</button>
                  <button type="button" onClick={() => setWizardStep(3)} disabled={!canAdvanceStepTwo} className="rounded-2xl bg-blue-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-400 disabled:opacity-40">Suivant</button>
                </div>
              </div>
            )}

            {wizardStep === 3 && (
              <div className="grid gap-5 xl:grid-cols-[1.15fr,0.85fr]">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-slate-100">Aperçus des images</p>
                    <p className="text-xs text-slate-400">Vérifiez l'image principale et la galerie avant l'enregistrement.</p>
                  </div>
                  {previewImages.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-3">
                      {previewImages.map((src, index) => (
                        <div key={`${src}-${index}`} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                          <div className="relative aspect-[4/3] bg-slate-900">
                            <img src={src} alt={`Preview ${index + 1}`} className="h-full w-full object-cover" />
                            <span className="absolute left-3 top-3 rounded-full bg-slate-950/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.3em] text-slate-100">{index === 0 ? "Principale" : `Galerie ${index}`}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState title="Aucun aperçu d'image pour l'instant" description="Ajoutez au moins une URL d'image pour activer l'aperçu visuel." />
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-2 text-sm">
                      <span className="text-slate-300">URL de l'image secondaire</span>
                      <input value={form.imageSecondary} onChange={(event) => setForm((value) => ({ ...value, imageSecondary: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-slate-100 outline-none" placeholder="Optional gallery image" />
                    </label>
                    <label className="space-y-2 text-sm">
                      <span className="text-slate-300">URL de la troisième image</span>
                      <input value={form.imageThird} onChange={(event) => setForm((value) => ({ ...value, imageThird: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-slate-100 outline-none" placeholder="Optional gallery image" />
                    </label>
                    <label className="space-y-2 text-sm sm:col-span-2">
                      <span className="text-slate-300">URL de la quatrième image</span>
                      <input value={form.imageFourth} onChange={(event) => setForm((value) => ({ ...value, imageFourth: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-slate-100 outline-none" placeholder="Optional gallery image" />
                    </label>
                  </div>
                </div>

                <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Aperçu en direct</p>
                    <h4 className="mt-2 text-lg font-semibold text-slate-50">{previewCar.brand || "Car name"} {previewCar.model || "preview"}</h4>
                    <p className="text-sm text-slate-400">{previewCar.category}</p>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950">
                    <div className="aspect-[16/10] bg-slate-900">
                      {previewCar.image ? (
                        <img src={previewCar.image} alt={`${previewCar.brand} ${previewCar.model}`} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-slate-500">Ajoutez une URL d'image principale pour prévisualiser le véhicule.</div>
                      )}
                    </div>
                    <div className="space-y-2 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Tarif journalier</span>
                        <span className="text-lg font-semibold text-slate-50">{previewCar.pricePerDay > 0 ? formatCurrency(previewCar.pricePerDay) : "—"}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 lg:grid-cols-4">
                        {previewCar.stats.map((stat) => (
                          <div key={stat.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-2">
                            <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">{stat.label}</p>
                            <p className="mt-1 text-slate-100">{stat.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-slate-300">
                    <div className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2">
                      <span>Slug préparé</span>
                      <span className="text-slate-100">{previewCar.slug || "—"}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2">
                      <span>Images de la galerie</span>
                      <span className="text-slate-100">{previewCar.gallery.length}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2">
                      <span>Année / kilométrage</span>
                      <span className="text-slate-100">{previewCar.year ?? "—"} / {previewCar.mileage ? `${previewCar.mileage.toLocaleString("fr-FR")} km` : "—"}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2">
                      <span>Couleur / portes</span>
                      <span className="text-slate-100">{previewCar.color ?? "—"} / {previewCar.doors ?? "—"}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2">
                      <span>Localisation</span>
                      <span className="text-slate-100">{previewCar.location ?? "—"}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2">
                      <span>Équipements</span>
                      <span className="text-slate-100">{previewCar.equipments.length}</span>
                    </div>
                  </div>

                  <div className="flex justify-between gap-3">
                    <button type="button" onClick={() => setWizardStep(2)} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-200">Retour</button>
                    <button type="submit" disabled={busy || !canAdvanceStepOne || !canAdvanceStepTwo} className="inline-flex items-center gap-2 rounded-2xl bg-blue-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-400 disabled:opacity-40">
                      {busy ? "Enregistrement..." : editingCar ? "Enregistrer les modifications" : "Créer la voiture"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </form>
        </ModalShell>
      ) : null}
    </div>
  );
};

export const AdminReservationsPage = () => {
  const { cars } = useCarInventory();
  const { reservations, refresh } = useReservations();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [reservationSort, setReservationSort] = useState<SortDirection>("newest");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [exportReservationsOpen, setExportReservationsOpen] = useState(false);
  const [exportPeriodMode, setExportPeriodMode] = useState<"all" | "range">("all");
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const [selectedReservation, setSelectedReservation] = useState<ReservationRecord | null>(null);
  const [pendingDeleteReservation, setPendingDeleteReservation] = useState<ReservationRecord | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const filteredReservations = useMemo(() => {
    return reservations.filter((reservation) => {
      if (statusFilter !== "all" && reservation.status !== statusFilter) {
        return false;
      }
      if (startDate && !isBetweenDates(reservation.pickupDate, startDate, endDate)) {
        return false;
      }
      if (endDate && !isBetweenDates(reservation.pickupDate, startDate, endDate)) {
        return false;
      }
      return true;
    });
  }, [endDate, reservations, startDate, statusFilter]);

  const sortedReservations = useMemo(() => sortByDate(filteredReservations, (reservation) => reservation.pickupDate, reservationSort), [filteredReservations, reservationSort]);
  const selectedReservationCar = useMemo(() => {
    if (!selectedReservation) {
      return null;
    }
    return cars.find((car) => car.remoteId === selectedReservation.carId) ?? null;
  }, [cars, selectedReservation]);

  const updateReservationStatus = async (reservationId: number, action: "confirm" | "cancel") => {
    setBusyId(reservationId);
    try {
      if (action === "confirm") {
        await apiClient.post(`/reservations/${reservationId}/confirm`);
        toast({ title: "Réservation confirmée", description: `La réservation #${reservationId} a été validée.` });
      } else {
        await apiClient.post(`/reservations/${reservationId}/cancel`, null, { params: { reason: "Cancelled from admin dashboard" } });
        toast({ title: "Réservation annulée", description: `La réservation #${reservationId} a été annulée.` });
      }
      await refresh();
    } catch (error) {
      toast({ title: "Impossible de mettre à jour la réservation", description: resolveFriendlyError(error), variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const deleteReservation = async (reservationId: number) => {
    setBusyId(reservationId);
    try {
      await apiClient.delete(`/reservations/${reservationId}`);
      toast({ title: "Réservation supprimée", description: `La réservation #${reservationId} a été supprimée.` });
      setSelectedReservation(null);
      setPendingDeleteReservation(null);
      await refresh();
    } catch (error) {
      toast({ title: "Impossible de supprimer la réservation", description: resolveFriendlyError(error), variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const handleExportReservationsExcel = () => {
    if (sortedReservations.length === 0) {
      toast({ title: "Aucune réservation à exporter", description: "Ajustez vos filtres puis réessayez.", variant: "destructive" });
      return;
    }

    if (exportPeriodMode === "range") {
      if (!exportStartDate && !exportEndDate) {
        toast({ title: "Sélectionnez une période", description: "Choisissez au moins une date de début ou de fin.", variant: "destructive" });
        return;
      }
      const start = parseDateInput(exportStartDate);
      const end = parseDateInput(exportEndDate);
      if (start && end && start > end) {
        toast({ title: "Période invalide", description: "La date de début doit être antérieure à la date de fin.", variant: "destructive" });
        return;
      }
    }

    const reservationsToExport = exportPeriodMode === "range"
      ? sortedReservations.filter((reservation) => isBetweenDates(reservation.pickupDate, exportStartDate, exportEndDate))
      : sortedReservations;

    if (reservationsToExport.length === 0) {
      toast({ title: "Aucune donnée dans cette période", description: "Ajustez la plage de dates puis réessayez.", variant: "destructive" });
      return;
    }

    const headers = ["ID", "Client", "Email", "Téléphone", "Véhicule", "Trajet", "Date départ", "Date retour", "Statut", "Montant", "Extras", "Notes"];
    const rows = reservationsToExport.map((reservation) => {
      const relatedCar = cars.find((car) => car.remoteId === reservation.carId);
      return [
        reservation.id,
        `${reservation.customerFirstName} ${reservation.customerLastName}`,
        reservation.customerEmail,
        reservation.customerPhone,
        relatedCar ? `${relatedCar.brand} ${relatedCar.model}` : `Voiture #${reservation.carId}`,
        `${reservation.pickupCity} -> ${reservation.returnCity}`,
        reservation.pickupDate,
        reservation.returnDate,
        reservation.status,
        extractReservationTotal(reservation),
        reservation.extras.join(", "),
        reservation.notes ?? "",
      ];
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Reservations");

    const exportDate = new Date().toISOString().slice(0, 10);
    const periodSuffix = exportPeriodMode === "range" ? "-periode" : "-toutes";
    XLSX.writeFile(workbook, `reservations${periodSuffix}-${exportDate}.xlsx`);
    setExportReservationsOpen(false);
    toast({ title: "Export terminé", description: `${reservationsToExport.length} réservation(s) exportée(s) en XLSX.` });
  };

  return (
    <div className="space-y-5">
      <SectionShell title="Réservations" description="File, filtres et actions">
        <div className="grid gap-3 md:grid-cols-[1.1fr,0.9fr,0.9fr,auto] md:items-end">
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-100 outline-none">
            <option value="all">Tous les statuts</option>
            <option value="PENDING_PAYMENT">En attente</option>
            <option value="CONFIRMED">Confirmée</option>
            <option value="CANCELLED">Annulée</option>
          </select>
          <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-100 outline-none" />
          <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-100 outline-none" />
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => setExportReservationsOpen(true)}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border  border-white/10 bg-white/[0.04] px-4 text-sm text-slate-200 transition hover:bg-white/10"
            >
              <Download className="h-4 w-4" />
              Export Excel
            </button>
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-slate-200 transition hover:bg-white/10"
            >
              <RefreshCcw className="h-4 w-4" />
              Rafraîchir
            </button>
            <SortDropdown value={reservationSort} onChange={setReservationSort} />
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-left text-sm">
              <thead className="bg-white/[0.04] text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Trajet</th>
                  <th className="px-4 py-3 font-medium">Dates</th>
                  <th className="px-4 py-3 font-medium">Montant</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-[#0f172a]">
                {filteredReservations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10"><EmptyState title="Aucune réservation trouvée" description="Ajustez les filtres pour afficher davantage de réservations." /></td>
                  </tr>
                ) : (
                  sortedReservations.map((reservation) => (
                    <tr
                      key={reservation.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Ouvrir les détails de la réservation #${reservation.id}`}
                      onClick={() => setSelectedReservation(reservation)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedReservation(reservation);
                        }
                      }}
                      className="cursor-pointer hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
                    >
                      <td className="px-4 py-4">
                        <p className="font-medium text-slate-50">{reservation.customerFirstName} {reservation.customerLastName}</p>
                        <p className="text-xs text-slate-400">{reservation.customerEmail}</p>
                      </td>
                      <td className="px-4 py-4 text-slate-300">{reservation.pickupCity} → {reservation.returnCity}</td>
                      <td className="px-4 py-4 text-slate-300">{formatDate(reservation.pickupDate)} - {formatDate(reservation.returnDate)}</td>
                      <td className="px-4 py-4 text-slate-100">{formatCurrency(extractReservationTotal(reservation))}</td>
                      <td className="px-4 py-4"><span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.25em] ${getReservationStatusBadge(reservation.status)}`}>{reservation.status}</span></td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => setSelectedReservation(reservation)} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-200">Détails</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </SectionShell>

      {exportReservationsOpen && (
        <ModalShell title="Exporter les réservations" description="Choisissez si vous voulez exporter toutes les réservations filtrées ou une période précise." onClose={() => setExportReservationsOpen(false)}>
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="mb-3 text-sm font-semibold text-slate-100">Période d'export</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setExportPeriodMode("all")}
                  className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                    exportPeriodMode === "all"
                      ? "border-blue-500/30 bg-blue-500/10 text-blue-200"
                      : "border-white/10 bg-[#0f172a] text-slate-200 hover:bg-white/[0.03]"
                  }`}
                >
                  <p className="font-semibold">Toutes les données</p>
                  <p className="text-xs text-slate-400">Exporte les réservations actuellement filtrées.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setExportPeriodMode("range")}
                  className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                    exportPeriodMode === "range"
                      ? "border-blue-500/30 bg-blue-500/10 text-blue-200"
                      : "border-white/10 bg-[#0f172a] text-slate-200 hover:bg-white/[0.03]"
                  }`}
                >
                  <p className="font-semibold">Sélectionner des dates</p>
                  <p className="text-xs text-slate-400">Filtre par date de départ dans l'intervalle choisi.</p>
                </button>
              </div>
            </div>

            {exportPeriodMode === "range" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm text-slate-300">
                  Date de début
                  <input
                    type="date"
                    value={exportStartDate}
                    onChange={(event) => setExportStartDate(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-slate-100 outline-none"
                  />
                </label>
                <label className="space-y-2 text-sm text-slate-300">
                  Date de fin
                  <input
                    type="date"
                    value={exportEndDate}
                    onChange={(event) => setExportEndDate(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-slate-100 outline-none"
                  />
                </label>
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setExportReservationsOpen(false)}
                className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/[0.04]"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleExportReservationsExcel}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-110"
              >
                <Download className="h-4 w-4" />
                Exporter en XLSX
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {selectedReservation && (
        <ModalShell title={`Réservation #${selectedReservation.id}`} description={`${selectedReservation.customerFirstName} ${selectedReservation.customerLastName}`} onClose={() => setSelectedReservation(null)}>
          <div className="grid gap-4 md:grid-cols-2">
            <DetailCard icon={CarFront} label="Voiture" value={selectedReservationCar ? `${selectedReservationCar.brand} ${selectedReservationCar.model}` : `Voiture #${selectedReservation.carId}`} subvalue={selectedReservationCar?.category ?? "Véhicule lié à la réservation"} />
            <DetailCard icon={CalendarRange} label="Période" value={`${formatDate(selectedReservation.pickupDate)} au ${formatDate(selectedReservation.returnDate)}`} subvalue={`${selectedReservation.pickupCity} → ${selectedReservation.returnCity}`} />
            <DetailCard icon={MapPin} label="Trajet" value={`${selectedReservation.pickupCity} → ${selectedReservation.returnCity}`} subvalue={`Réservation #${selectedReservation.id} • Voiture ${selectedReservation.carId}`} />
            <DetailCard icon={Mail} label="Email" value={selectedReservation.customerEmail} subvalue="Contact direct" href={`mailto:${selectedReservation.customerEmail}`} />
            <DetailCard icon={Phone} label="Téléphone" value={selectedReservation.customerPhone} subvalue="WhatsApp" href={`https://wa.me/${normalizePhoneToWhatsapp(selectedReservation.customerPhone)}`} />
            <DetailCard icon={CircleDollarSign} label="Montant" value={formatCurrency(extractReservationTotal(selectedReservation))} subvalue="Total calculé depuis la réservation" />
            <DetailCard icon={ShieldCheck} label="Statut" value={selectedReservation.status} subvalue="État actuel" />
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:col-span-2">
              <div className="flex items-center gap-3">
                <Clipboard className="h-4 w-4 text-slate-400" />
                <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Extras</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedReservation.extras.length === 0 ? (
                  <span className="text-sm text-slate-400">Aucun extra sélectionné</span>
                ) : (
                  selectedReservation.extras.map((extra) => (
                    <span key={extra} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-200">{extra}</span>
                  ))
                )}
              </div>
            </div>
            
            <div className="md:col-span-2 flex flex-wrap items-center justify-end gap-3">
              <button type="button" disabled={busyId === selectedReservation.id} onClick={() => void updateReservationStatus(selectedReservation.id, "confirm")} className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
                <CheckCircle2 className="h-4 w-4" />
                Confirmer
              </button>
              <button type="button" disabled={busyId === selectedReservation.id} onClick={() => void updateReservationStatus(selectedReservation.id, "cancel")} className="inline-flex items-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-sm text-rose-200">
                <XCircle className="h-4 w-4" />
                Annuler
              </button>
              <button
                type="button"
                disabled={busyId === selectedReservation.id}
                onClick={() => setPendingDeleteReservation(selectedReservation)}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
              >
                <Trash2 className="h-4 w-4" />
                Supprimer
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {pendingDeleteReservation && (
        <ModalShell title="Confirmer la suppression" description={`Réservation #${pendingDeleteReservation.id}`} onClose={() => setPendingDeleteReservation(null)}>
          <div className="space-y-4">
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-100">
              Supprimer cette réservation est irréversible. Les données de cette réservation seront effacées du système.
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <DetailCard icon={CarFront} label="Client" value={`${pendingDeleteReservation.customerFirstName} ${pendingDeleteReservation.customerLastName}`} subvalue={pendingDeleteReservation.customerEmail} />
              <DetailCard icon={CalendarRange} label="Période" value={`${formatDate(pendingDeleteReservation.pickupDate)} au ${formatDate(pendingDeleteReservation.returnDate)}`} subvalue={`${pendingDeleteReservation.pickupCity} → ${pendingDeleteReservation.returnCity}`} />
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => setPendingDeleteReservation(null)} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-200 hover:bg-white/10">
                <XCircle className="h-4 w-4" />
                Annuler
              </button>
              <button type="button" disabled={busyId === pendingDeleteReservation.id} onClick={() => void deleteReservation(pendingDeleteReservation.id)} className="inline-flex items-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-sm text-rose-200 hover:bg-rose-500/15 disabled:opacity-50">
                <Trash2 className="h-4 w-4" />
                Supprimer définitivement
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
};

export const AdminCustomersPage = () => {
  const { reservations } = useReservations();
  const [customerSort, setCustomerSort] = useState<SortDirection>("newest");
  const customers = useMemo<CustomerRecord[]>(() => {
    const map = new Map<string, CustomerRecord>();
    reservations.forEach((reservation) => {
      const key = normalize(reservation.customerEmail);
      const current = map.get(key);
      const amount = extractReservationTotal(reservation);
      if (!current) {
        map.set(key, {
          name: `${reservation.customerFirstName} ${reservation.customerLastName}`,
          email: reservation.customerEmail,
          phone: reservation.customerPhone,
          reservations: 1,
          spent: amount,
          lastVisit: reservation.pickupDate,
        });
        return;
      }
      current.reservations += 1;
      current.spent += amount;
      if (reservation.pickupDate > current.lastVisit) {
        current.lastVisit = reservation.pickupDate;
      }
    });
    return [...map.values()].sort((left, right) => right.spent - left.spent);
  }, [reservations]);

  const sortedCustomers = useMemo(() => sortByDate(customers, (customer) => customer.lastVisit, customerSort), [customers, customerSort]);

  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);
  const selectedHistory = useMemo(() => {
    if (!selectedCustomer) {
      return [];
    }
    return reservations.filter((reservation) => normalize(reservation.customerEmail) === normalize(selectedCustomer.email));
  }, [reservations, selectedCustomer]);

  return (
    <div className="space-y-5">
      <SectionShell title="Clients" description="Profils et historique">
        <div className="mb-4 flex justify-end">
          <SortDropdown value={customerSort} onChange={setCustomerSort} />
        </div>
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-left text-sm">
              <thead className="bg-white/[0.04] text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Réservations</th>
                  <th className="px-4 py-3 font-medium">Dépensé</th>
                  <th className="px-4 py-3 font-medium">Dernière visite</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-[#0f172a]">
                {customers.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-10"><EmptyState title="Aucun client pour l'instant" description="Les clients sont déduits des réservations." /></td></tr>
                ) : sortedCustomers.map((customer) => (
                  <tr key={customer.email} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-4">
                      <p className="font-medium text-slate-50">{customer.name}</p>
                      <p className="text-xs text-slate-400">{customer.email}</p>
                    </td>
                    <td className="px-4 py-4 text-slate-300">{customer.reservations}</td>
                    <td className="px-4 py-4 text-slate-200">{formatCurrency(customer.spent)}</td>
                    <td className="px-4 py-4 text-slate-300">{formatDate(customer.lastVisit)}</td>
                    <td className="px-4 py-4"><button type="button" onClick={() => setSelectedCustomer(customer)} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-200">Historique</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </SectionShell>

      {selectedCustomer && (
        <ModalShell title={selectedCustomer.name} description={selectedCustomer.email} onClose={() => setSelectedCustomer(null)}>
          <div className="space-y-3">
            {selectedHistory.map((reservation) => (
              <div key={reservation.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-50">Réservation #{reservation.id}</p>
                    <p className="text-sm text-slate-400">{reservation.pickupCity} • {formatDate(reservation.pickupDate)}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.25em] ${getReservationStatusBadge(reservation.status)}`}>{reservation.status}</span>
                </div>
              </div>
            ))}
          </div>
        </ModalShell>
      )}
    </div>
  );
};

export const AdminPaymentsPage = () => {
  const { reservations } = useReservations();
  const [providerFilter, setProviderFilter] = useState<"all" | PaymentProvider>("all");
  const [paymentSort, setPaymentSort] = useState<SortDirection>("newest");

  const payments = useMemo<PaymentRecord[]>(() => {
    return reservations.map((reservation, index) => {
      const provider: PaymentProvider = reservation.notes?.toLowerCase().includes("paypal")
        ? "PayPal"
        : reservation.notes?.toLowerCase().includes("stripe")
          ? "Stripe"
          : "Direct";
      const status: PaymentRecord["status"] = reservation.status === "CANCELLED" ? "Refunded" : reservation.status === "PENDING_PAYMENT" ? "Pending" : "Paid";
      return {
        id: index + 1,
        reservationId: reservation.id,
        customer: `${reservation.customerFirstName} ${reservation.customerLastName}`,
        provider,
        amount: extractReservationTotal(reservation),
        currency: "MAD",
        status,
        date: reservation.pickupDate,
      };
    });
  }, [reservations]);

  const filteredPayments = useMemo(() => {
    return providerFilter === "all" ? payments : payments.filter((payment) => payment.provider === providerFilter);
  }, [payments, providerFilter]);

  const sortedPayments = useMemo(() => sortByDate(filteredPayments, (payment) => payment.date, paymentSort), [filteredPayments, paymentSort]);

  return (
    <div className="space-y-5">
      <SectionShell title="Paiements" description="Statut, prestataire et montant">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-300">{payments.filter((payment) => payment.status === "Paid").length} payés</div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-300">{payments.filter((payment) => payment.status === "Pending").length} en attente</div>
          <select value={providerFilter} onChange={(event) => setProviderFilter(event.target.value as typeof providerFilter)} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-100 outline-none">
            <option value="all">Tous les prestataires</option>
            <option value="Stripe">Stripe</option>
            <option value="PayPal">PayPal</option>
            <option value="Direct">Direct</option>
          </select>
          <SortDropdown value={paymentSort} onChange={setPaymentSort} />
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-left text-sm">
              <thead className="bg-white/[0.04] text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Prestataire</th>
                  <th className="px-4 py-3 font-medium">Montant</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-[#0f172a]">
                {filteredPayments.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-10"><EmptyState title="Aucune ligne de paiement" description="Les paiements sont déduits des réservations." /></td></tr>
                ) : sortedPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-4 text-slate-100">{payment.customer}</td>
                    <td className="px-4 py-4 text-slate-300">{payment.provider}</td>
                    <td className="px-4 py-4 text-slate-200">{formatCurrency(payment.amount)}</td>
                    <td className="px-4 py-4 text-slate-300">{payment.status}</td>
                    <td className="px-4 py-4 text-slate-300">{formatDate(payment.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </SectionShell>
    </div>
  );
};

export const AdminReportsPage = () => {
  const { cars } = useCarInventory();
  const { reservations } = useReservations();

  const reportData = useMemo(() => {
    const now = Date.now();
    const bookings = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now - (6 - index) * 24 * 60 * 60 * 1000);
      const day = date.toISOString().slice(0, 10);
      const dayReservations = reservations.filter((reservation) => reservation.pickupDate.slice(0, 10) === day);
      return {
        label: date.toLocaleDateString("fr-FR", { weekday: "short" }),
        value: dayReservations.length,
        revenue: dayReservations.reduce((sum, reservation) => sum + extractReservationTotal(reservation), 0),
      };
    });
    const mostRented = [...cars]
      .map((car) => ({ car, bookings: reservations.filter((reservation) => reservation.carId === (car.remoteId ?? -1)).length }))
      .sort((left, right) => right.bookings - left.bookings)
      .slice(0, 5);
    return { bookings, mostRented };
  }, [cars, reservations]);

  return (
    <div className="space-y-5">
      <SectionShell title="Rapports & indicateurs" description="Revenus, réservations et occupation">
        <div className="grid gap-5 xl:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="mb-4 text-sm font-medium text-slate-100">Tendance des réservations</p>
            <div className="h-[280px] w-full">
              <ResponsiveContainer>
                <BarChart data={reportData.bookings}>
                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(148,163,184,0.14)" />
                  <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "rgba(15,23,42,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16 }} />
                  <Bar dataKey="value" fill="#3b82f6" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="mb-4 text-sm font-medium text-slate-100">Tendance des revenus</p>
            <div className="h-[280px] w-full">
              <ResponsiveContainer>
                <LineChart data={reportData.bookings}>
                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(148,163,184,0.14)" />
                  <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ background: "rgba(15,23,42,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16 }} />
                  <Line type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Jour de pointe</p>
            <p className="mt-3 text-2xl font-semibold text-slate-50">Saturday</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Durée moyenne de location</p>
            <p className="mt-3 text-2xl font-semibold text-slate-50">4,7 jours</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Voitures les plus louées</p>
            <div className="mt-3 space-y-2 text-sm text-slate-300">
              {reportData.mostRented.slice(0, 3).map(({ car, bookings }) => (
                <div key={car.id} className="flex items-center justify-between">
                  <span>{car.brand} {car.model}</span>
                  <span>{bookings}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionShell>
    </div>
  );
};

export const AdminSettingsPage = () => {
  const { user, login, updateUser } = useAuth();
  const { toast } = useToast();
  const [emailForm, setEmailForm] = useState({ currentEmail: user?.email ?? "", newEmail: "", password: "" });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEmailForm((current) => ({ ...current, currentEmail: user?.email ?? current.currentEmail }));
  }, [user?.email]);

  const handleEmailSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      await apiClient.post("/auth/change-email", {
        currentEmail: emailForm.currentEmail.trim().toLowerCase(),
        newEmail: emailForm.newEmail.trim().toLowerCase(),
        currentPassword: emailForm.password,
      });
      try {
        await login({ email: emailForm.newEmail.trim().toLowerCase(), password: emailForm.password });
      } catch {
        updateUser({ email: emailForm.newEmail.trim().toLowerCase(), id: emailForm.newEmail.trim().toLowerCase() });
      }
      toast({ title: "Email mis à jour", description: "Votre email de connexion a été actualisé." });
      setEmailForm({ currentEmail: emailForm.newEmail.trim().toLowerCase(), newEmail: "", password: "" });
    } catch (error) {
      toast({ title: "Impossible de mettre à jour l'email", description: resolveFriendlyError(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({ title: "Mots de passe non identiques", description: "Les nouveaux mots de passe ne correspondent pas.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await apiClient.post("/auth/change-password", {
        email: emailForm.currentEmail.trim().toLowerCase(),
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      toast({ title: "Mot de passe mis à jour", description: "Vos identifiants ont été renforcés." });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (error) {
      toast({ title: "Impossible de mettre à jour le mot de passe", description: resolveFriendlyError(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <SectionShell title="Paramètres" description="Profil et préférences">
        <div className="grid gap-5 xl:grid-cols-2">
          <form onSubmit={(event) => void handleEmailSubmit(event)} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-4">
            <div>
              <p className="text-sm font-medium text-slate-100">Paramètres du profil</p>
              <p className="text-xs text-slate-400">Modifiez l'adresse de connexion de ce compte admin.</p>
            </div>
            <label className="block space-y-2 text-sm">
              <span className="text-slate-300">Email actuel</span>
              <input value={emailForm.currentEmail} onChange={(event) => setEmailForm((value) => ({ ...value, currentEmail: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-slate-100 outline-none" />
            </label>
            <label className="block space-y-2 text-sm">
              <span className="text-slate-300">Nouvel email</span>
              <input value={emailForm.newEmail} onChange={(event) => setEmailForm((value) => ({ ...value, newEmail: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-slate-100 outline-none" />
            </label>
            <label className="block space-y-2 text-sm">
              <span className="text-slate-300">Password</span>
              <input type="password" value={emailForm.password} onChange={(event) => setEmailForm((value) => ({ ...value, password: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-slate-100 outline-none" />
            </label>
            <button type="submit" disabled={saving} className="rounded-2xl bg-blue-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-400">Save email</button>
          </form>

          <form onSubmit={(event) => void handlePasswordSubmit(event)} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-4">
            <div>
              <p className="text-sm font-medium text-slate-100">Security</p>
              <p className="text-xs text-slate-400">Rotate the password and keep the account secure.</p>
            </div>
            <label className="block space-y-2 text-sm">
              <span className="text-slate-300">Mot de passe actuel</span>
              <input type="password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((value) => ({ ...value, currentPassword: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-slate-100 outline-none" />
            </label>
            <label className="block space-y-2 text-sm">
              <span className="text-slate-300">Nouveau mot de passe</span>
              <input type="password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm((value) => ({ ...value, newPassword: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-slate-100 outline-none" />
            </label>
            <label className="block space-y-2 text-sm">
              <span className="text-slate-300">Confirmer le mot de passe</span>
              <input type="password" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm((value) => ({ ...value, confirmPassword: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-slate-100 outline-none" />
            </label>
            <button type="submit" disabled={saving} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/10">Enregistrer le mot de passe</button>
          </form>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Alertes email</p>
            <p className="mt-3 text-sm text-slate-300">Activées</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">System density</p>
            <p className="mt-3 text-sm text-slate-300">Compact</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Access level</p>
            <p className="mt-3 text-sm text-slate-300">ADMIN / CLIENT JWT</p>
          </div>
        </div>
      </SectionShell>
    </div>
  );
};