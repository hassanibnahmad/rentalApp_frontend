import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BellRing,
  CalendarPlus,
  CalendarClock,
  CarFront,
  CheckCircle2,
  Clock3,
  CreditCard,
  Download,
  EllipsisVertical,
  Filter,
  MapPin,
  Gauge,
  Home,
  LogOut,
  Menu,
  MessageSquare,
  PlusCircle,
  RefreshCcw,
  Lightbulb,
  TrendingUp,
  Trash2,
  UserPlus,
  Wand2,
  Wrench,
  XCircle,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useAuth } from "@/contexts/AuthContext";
import { useCarInventory } from "@/contexts/CarInventoryContext";
import { defaultHighlights, type CarDetail } from "@/data/cars";
import { apiClient } from "@/lib/api-client";
import { resolveFriendlyError } from "@/lib/errors";
import { useToast } from "@/components/ui/use-toast";
import * as XLSX from "xlsx-js-style";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const createEmptyFormState = () => ({
  brand: "",
  model: "",
  category: "",
  description: "",
  pricePerDay: "",
  transmission: "Automatique",
  fuel: "Diesel",
  seats: "5",
  image: "",
  imageSecondary: "",
  imageThird: "",
  whatsappMessage: "",
  equipments: "",
});

type CarFormState = ReturnType<typeof createEmptyFormState>;

const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const parseEquipments = (value: string) =>
  value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);

const cloneHighlights = () => defaultHighlights.map((highlight) => ({ ...highlight }));

const createGallery = (slug: string, images: string | string[]) => {
  const sources = (Array.isArray(images) ? images : [images]).filter(Boolean);
  const fallback = sources[0] ?? "";
  const labels = ["Profil", "Intérieur", "Night Ride"];
  const ids = ["main", "detail", "night"];
  return labels.map((label, index) => ({
    id: `${slug}-${ids[index] ?? `shot-${index}`}`,
    label,
    image: sources[index] ?? fallback,
  }));
};

const buildCarRecord = (form: CarFormState, existing?: CarDetail): CarDetail => {
  const brand = form.brand.trim();
  const model = form.model.trim();
  const slug = slugify(`${brand}-${model}`);
  const image = form.image.trim();
  const imageSecondary = form.imageSecondary?.trim() ?? "";
  const imageThird = form.imageThird?.trim() ?? "";
  const equipments = parseEquipments(form.equipments);
  const gallerySources = [image, imageSecondary, imageThird].filter(Boolean);
  const fallbackGallery = createGallery(slug, gallerySources.length > 0 ? gallerySources : image);
  const galleryLength = Math.max(existing?.gallery?.length ?? 0, fallbackGallery.length);
  const gallery = Array.from({ length: galleryLength || 1 }).map((_, index) => {
    const previous = existing?.gallery?.[index];
    const fallback = fallbackGallery[index] ?? fallbackGallery[fallbackGallery.length - 1];
    const nextImage = gallerySources[index] ?? previous?.image ?? fallback?.image ?? image;
    if (previous) {
      return { ...previous, image: nextImage };
    }
    if (fallback) {
      return { ...fallback, image: nextImage };
    }
    return {
      id: `${slug}-shot-${index}`,
      label: `Vue ${index + 1}`,
      image: nextImage,
    };
  });
  const seats = Number(form.seats) || 5;
  const price = Number(form.pricePerDay) || 0;

  return {
    id: existing?.id ?? `car-${Date.now()}`,
    remoteId: existing?.remoteId,
    slug,
    brand,
    model,
    category: form.category.trim() || "Sans catégorie",
    description:
      form.description.trim() ||
      "Veuillez compléter la description pour mettre ce véhicule en valeur.",
    pricePerDay: price,
    transmission: form.transmission,
    fuel: form.fuel,
    seats,
    image,
    gallery,
    stats: [
      { label: "Transmission", value: form.transmission },
      { label: "Carburant", value: form.fuel },
      { label: "Capacité", value: `${seats} places` },
    ],
    equipments:
      equipments.length > 0
        ? equipments
        : [
            "Assistance 24/7",
            "Livraison à l'aéroport",
            "Bluetooth + USB",
            "Climatisation automatique",
          ],
    highlights: (existing?.highlights ?? cloneHighlights()).map((highlight) => ({ ...highlight })),
    whatsappMessage:
      form.whatsappMessage.trim() || `Bonjour, je souhaite réserver la ${brand} ${model}.`,
  };
};

const formatCurrency = (value: number) => new Intl.NumberFormat("fr-MA").format(value);

const buildGoogleMapsSearchUrl = (query: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query.trim())}`;

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const parseLocalDate = (rawDate: string) => {
  const parsed = new Date(`${rawDate}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

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

type ExportPeriodMode = "all" | "range";

type QuickReservationForm = {
  carId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  documentId: string;
  pickupCity: string;
  pickupDate: string;
  returnCity: string;
  returnDate: string;
  notes: string;
};

type QuickCarForm = {
  brand: string;
  model: string;
  category: string;
  pricePerDay: string;
  transmission: string;
  fuel: string;
  seats: string;
  image: string;
};

type QuickCustomerForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

type ConfirmDialogState =
  | { type: "car-delete"; car: CarDetail }
  | { type: "reservation-delete"; reservation: ReservationRecord }
  | { type: "fleet-reset" };

type ConfirmDialogCopy = {
  title: string;
  description: string;
  confirmLabel: string;
  tone: "destructive" | "primary";
};

const statusStyles: Record<string, string> = {
  CONFIRMED: "bg-emerald-500/10 text-emerald-200",
  PENDING_PAYMENT: "bg-amber-500/10 text-amber-200",
  DRAFT: "bg-secondary/400/10 text-slate-200",
  CANCELLED: "bg-red-500/10 text-red-200",
  COMPLETED: "bg-primary/100/10 text-blue-200",
};

const extractEstimatedTotal = (notes?: string | null): number | null => {
  if (!notes) {
    return null;
  }
  const match = notes.match(/Total\s+estim[ée]\s+client:\s*([\d\s.,]+)/i);
  if (!match) {
    return null;
  }
  const normalized = match[1].replace(/\s+/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const getDisplayTotalAmount = (reservation: ReservationRecord): number => {
  const estimated = extractEstimatedTotal(reservation.notes);
  if (estimated != null) {
    return estimated;
  }
  return typeof reservation.totalAmount === "number" ? reservation.totalAmount : 0;
};

const resolveAccountError = (issue: unknown) =>
  resolveFriendlyError(issue, {
    defaultMessage: "Impossible de mettre à jour vos identifiants.",
    validation: "Merci de vérifier les informations saisies.",
    unauthorized: "Session expirée. Veuillez vous reconnecter.",
    forbidden: "Action non autorisée pour ce compte.",
    network: "Serveur injoignable. Réessayez dans un instant.",
  });

const dashboardNav = [
  { key: "cars", label: "Gestion flotte", description: "Fiches véhicules" },
  { key: "reservations", label: "Réservations", description: "Demandes clients" },
  { key: "account", label: "Compte & sécurité", description: "Identifiants" },
] as const;

type DashboardSection = (typeof dashboardNav)[number]["key"];

const AdminDashboard = () => {
  const { cars, addCar, updateCar, deleteCar, resetCars, loading, error } = useCarInventory();
  const { toast } = useToast();
  const { user, updateUser, login, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const adminEmail = user?.email ?? "";
  const [formState, setFormState] = useState<CarFormState>(createEmptyFormState());
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editingRemoteId, setEditingRemoteId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [pendingAction, setPendingAction] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [reservations, setReservations] = useState<ReservationRecord[]>([]);
  const [reservationsLoading, setReservationsLoading] = useState<boolean>(true);
  const [reservationsError, setReservationsError] = useState<string | null>(null);
  const [reservationProcessing, setReservationProcessing] = useState<number | null>(null);
  const [reservationStatusFilter, setReservationStatusFilter] = useState<string | null>(null);
  const [exportReservationsOpen, setExportReservationsOpen] = useState(false);
  const [exportPeriodMode, setExportPeriodMode] = useState<ExportPeriodMode>("all");
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const [selectedReservation, setSelectedReservation] = useState<ReservationRecord | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [confirmingAction, setConfirmingAction] = useState(false);
  const [activeSection, setActiveSection] = useState<DashboardSection>("cars");
  const [emailForm, setEmailForm] = useState({ currentEmail: adminEmail, newEmail: "", password: "" });
  const [emailFeedback, setEmailFeedback] = useState<
    { tone: "success" | "warning" | "error"; message: string } | null
  >(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordFeedback, setPasswordFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [navDrawerOpen, setNavDrawerOpen] = useState(false);
  const [revenueWindow, setRevenueWindow] = useState<7 | 30>(7);
  const [quickReservationOpen, setQuickReservationOpen] = useState(false);
  const [quickVehicleOpen, setQuickVehicleOpen] = useState(false);
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false);
  const [quickReservationLoading, setQuickReservationLoading] = useState(false);
  const [quickVehicleLoading, setQuickVehicleLoading] = useState(false);
  const [quickReservationForm, setQuickReservationForm] = useState<QuickReservationForm>({
    carId: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    documentId: "",
    pickupCity: "Agadir",
    pickupDate: "",
    returnCity: "Agadir",
    returnDate: "",
    notes: "",
  });
  const [quickCarForm, setQuickCarForm] = useState<QuickCarForm>({
    brand: "",
    model: "",
    category: "SUV",
    pricePerDay: "",
    transmission: "Automatique",
    fuel: "Diesel",
    seats: "5",
    image: "",
  });
  const [quickCustomerForm, setQuickCustomerForm] = useState<QuickCustomerForm>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  const handleDashboardLogout = useCallback(() => {
    logout();
    navigate("/");
  }, [logout, navigate]);

  const scrollToPanel = useCallback((panelId: string) => {
    document.getElementById(panelId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const reservationStats = useMemo(() => {
    return reservations.reduce(
      (acc, reservation) => {
        switch (reservation.status) {
          case "CONFIRMED":
            acc.confirmed += 1;
            break;
          case "PENDING_PAYMENT":
            acc.pending += 1;
            break;
          case "CANCELLED":
            acc.cancelled += 1;
            break;
          default:
            acc.draft += 1;
            break;
        }
        if (new Date(reservation.pickupDate).getTime() >= Date.now()) {
          acc.upcoming += 1;
        }
        return acc;
      },
      { confirmed: 0, pending: 0, cancelled: 0, draft: 0, upcoming: 0 },
    );
  }, [reservations]);

  const highlightedReservations = useMemo(() => reservations.slice(0, 4), [reservations]);
  const highlightedCars = useMemo(() => cars.slice(0, 4), [cars]);
  const filteredReservations = useMemo(() => {
    if (!reservationStatusFilter) return reservations;
    return reservations.filter((r) => r.status === reservationStatusFilter);
  }, [reservations, reservationStatusFilter]);

  const buildReservationsForExport = useCallback(() => {
    if (exportPeriodMode === "all") {
      return filteredReservations;
    }

    const start = exportStartDate ? parseLocalDate(exportStartDate) : null;
    const end = exportEndDate ? parseLocalDate(exportEndDate) : null;
    if (!start || !end) {
      return null;
    }

    const rangeStart = startOfDay(start);
    const rangeEnd = startOfDay(end);
    if (rangeStart.getTime() > rangeEnd.getTime()) {
      return null;
    }

    return filteredReservations.filter((reservation) => {
      const pickupDate = parseLocalDate(reservation.pickupDate);
      if (!pickupDate) {
        return false;
      }
      const normalizedPickup = startOfDay(pickupDate);
      return normalizedPickup.getTime() >= rangeStart.getTime() && normalizedPickup.getTime() <= rangeEnd.getTime();
    });
  }, [exportEndDate, exportPeriodMode, exportStartDate, filteredReservations]);

  const reservationOverview = useMemo(
    () => [
      {
        key: "total",
        label: "Demandes suivies",
        helper: "Toutes les demandes actives",
        value: reservations.length,
        cardClass: "border-border bg-card shadow-sm",
        valueClass: "text-foreground",
      },
      {
        key: "confirmed",
        label: "Confirmées",
        helper: "Prêtes à être livrées",
        value: reservationStats.confirmed,
        cardClass: "border-emerald-200 bg-card shadow-sm",
        valueClass: "text-emerald-600",
      },
      {
        key: "pending",
        label: "En attente",
        helper: "Demandes à valider",
        value: reservationStats.pending,
        cardClass: "border-amber-200 bg-card shadow-sm",
        valueClass: "text-amber-600",
      },
      {
        key: "cancelled",
        label: "Annulées",
        helper: "Dernières annulations",
        value: reservationStats.cancelled,
        cardClass: "border-red-200 bg-card shadow-sm",
        valueClass: "text-red-600",
      },
      {
        key: "draft",
        label: "À qualifier",
        helper: "Demandes à clarifier",
        value: reservationStats.draft,
        cardClass: "border-border bg-card shadow-sm",
        valueClass: "text-foreground",
      },
      {
        key: "upcoming",
        label: "Départs à venir",
        helper: "Trajets programmés",
        value: reservationStats.upcoming,
        cardClass: "border-cyan-200 bg-card shadow-sm",
        valueClass: "text-cyan-600",
      },
    ],
    [reservationStats, reservations.length],
  );

  const dashboardAnalytics = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    const tomorrow = new Date(today.getTime() + DAY_MS);
    const dayAfterTomorrow = new Date(tomorrow.getTime() + DAY_MS);
    const yesterday = new Date(today.getTime() - DAY_MS);
    const weekStart = new Date(today.getTime() - 6 * DAY_MS);
    const previousWeekStart = new Date(today.getTime() - 13 * DAY_MS);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const previousMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const currentYearStart = new Date(today.getFullYear(), 0, 1);

    const reservationWithDate = reservations
      .map((reservation) => ({
        reservation,
        pickupDate: parseLocalDate(reservation.pickupDate),
        returnDate: parseLocalDate(reservation.returnDate),
      }))
      .filter((entry) => entry.pickupDate != null);

    const revenueEligibleStatuses = new Set(["CONFIRMED", "PENDING_PAYMENT", "COMPLETED"]);
    const activeStatuses = new Set(["CONFIRMED", "PENDING_PAYMENT"]);

    const sumRevenueBetween = (start: Date, endExclusive: Date) =>
      reservationWithDate.reduce((sum, entry) => {
        if (!entry.pickupDate || !revenueEligibleStatuses.has(entry.reservation.status)) {
          return sum;
        }
        if (entry.pickupDate >= start && entry.pickupDate < endExclusive) {
          return sum + getDisplayTotalAmount(entry.reservation);
        }
        return sum;
      }, 0);

    const revenueToday = sumRevenueBetween(today, tomorrow);
    const revenueYesterday = sumRevenueBetween(yesterday, today);
    const revenueWeek = sumRevenueBetween(weekStart, dayAfterTomorrow);
    const revenuePreviousWeek = sumRevenueBetween(previousWeekStart, weekStart);
    const revenueMonth = sumRevenueBetween(monthStart, dayAfterTomorrow);
    const revenuePreviousMonth = sumRevenueBetween(previousMonthStart, monthStart);
    const revenueYear = sumRevenueBetween(currentYearStart, dayAfterTomorrow);

    const revenueTimeline = Array.from({ length: 30 }, (_, index) => {
      const date = new Date(today.getTime() - (29 - index) * DAY_MS);
      const nextDate = new Date(date.getTime() + DAY_MS);
      const label = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" }).format(date);
      return {
        label,
        revenue: sumRevenueBetween(date, nextDate),
      };
    });

    const carsInMaintenance = cars.filter((car) =>
      /maintenance|entretien|atelier/i.test(`${car.category} ${car.description}`),
    ).length;
    const rentedCarIds = new Set(
      reservationWithDate
        .filter((entry) => {
          if (!entry.pickupDate || !entry.returnDate || !activeStatuses.has(entry.reservation.status)) {
            return false;
          }
          return entry.pickupDate <= now && entry.returnDate >= today;
        })
        .map((entry) => entry.reservation.carId),
    );

    const rentedCars = Math.min(rentedCarIds.size, Math.max(cars.length - carsInMaintenance, 0));
    const availableCars = Math.max(cars.length - rentedCars - carsInMaintenance, 0);

    const enrichedUpcoming = reservationWithDate
      .filter((entry) => entry.pickupDate && entry.pickupDate >= today)
      .sort((a, b) => (a.pickupDate?.getTime() ?? 0) - (b.pickupDate?.getTime() ?? 0))
      .map((entry) => {
        const relatedCar = cars.find((car) => car.remoteId === entry.reservation.carId);
        const pickupTime = entry.reservation.notes?.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/)?.[0] ?? "10:00";
        return {
          id: entry.reservation.id,
          customer: `${entry.reservation.customerFirstName} ${entry.reservation.customerLastName}`,
          carLabel: relatedCar
            ? `${relatedCar.brand} ${relatedCar.model}`
            : `Véhicule #${entry.reservation.carId}`,
          pickupDate: entry.pickupDate,
          pickupTime,
        };
      });

    const upcomingToday = enrichedUpcoming.filter(
      (item) => item.pickupDate >= today && item.pickupDate < tomorrow,
    );
    const upcomingTomorrow = enrichedUpcoming.filter(
      (item) => item.pickupDate >= tomorrow && item.pickupDate < dayAfterTomorrow,
    );

    const topCarsMap = reservations.reduce<Record<number, number>>((acc, reservation) => {
      if (reservation.status === "CANCELLED") {
        return acc;
      }
      acc[reservation.carId] = (acc[reservation.carId] ?? 0) + 1;
      return acc;
    }, {});
    const topCars = Object.entries(topCarsMap)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 3)
      .map(([carId, bookings]) => {
        const car = cars.find((item) => item.remoteId === Number(carId));
        return {
          name: car ? `${car.brand} ${car.model}` : `Véhicule #${carId}`,
          bookings: Number(bookings),
        };
      });

    const cancellationRate = reservations.length
      ? Math.round((reservationStats.cancelled / reservations.length) * 100)
      : 0;

    const averageRentalDurationDaysRaw = reservationWithDate.reduce(
      (acc, entry) => {
        if (!entry.pickupDate || !entry.returnDate || entry.reservation.status === "CANCELLED") {
          return acc;
        }
        const diff = Math.max(1, Math.round((entry.returnDate.getTime() - entry.pickupDate.getTime()) / DAY_MS));
        return { totalDays: acc.totalDays + diff, count: acc.count + 1 };
      },
      { totalDays: 0, count: 0 },
    );
    const averageRentalDurationDays = averageRentalDurationDaysRaw.count
      ? Number((averageRentalDurationDaysRaw.totalDays / averageRentalDurationDaysRaw.count).toFixed(1))
      : 0;

    const dayFormatter = new Intl.DateTimeFormat("fr-FR", { weekday: "long" });
    const pickupDayCounts = reservationWithDate.reduce<Record<string, number>>((acc, entry) => {
      if (!entry.pickupDate) {
        return acc;
      }
      const dayLabel = dayFormatter.format(entry.pickupDate);
      acc[dayLabel] = (acc[dayLabel] ?? 0) + 1;
      return acc;
    }, {});
    const peakBookingDay =
      Object.entries(pickupDayCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Vendredi";

    const pendingPayments = reservations
      .filter((reservation) => reservation.status === "PENDING_PAYMENT")
      .reduce((sum, reservation) => sum + getDisplayTotalAmount(reservation), 0);

    const mostRentedCar = topCars[0]?.name ?? "Aucun véhicule";

    const notifications = [
      {
        id: "returns-today",
        text:
          upcomingToday.length > 0
            ? `${upcomingToday[0].carLabel} revient aujourd'hui`
            : "Aucun retour prévu aujourd'hui",
      },
      {
        id: "pending-approvals",
        text: `${reservationStats.pending} réservation(s) en attente de validation`,
      },
      {
        id: "maintenance-cars",
        text: `${carsInMaintenance} véhicule(s) en maintenance`,
      },
    ];

    return {
      revenueToday,
      revenueYesterday,
      revenueWeek,
      revenuePreviousWeek,
      revenueMonth,
      revenuePreviousMonth,
      revenueYear,
      pendingPayments,
      revenueLast7: revenueTimeline.slice(-7),
      revenueLast30: revenueTimeline,
      fleetStatusData: [
        { label: "Disponible", value: availableCars, color: "#34d399" },
        { label: "Loué", value: rentedCars, color: "#60a5fa" },
        { label: "Maintenance", value: carsInMaintenance, color: "#f59e0b" },
      ],
      fleetCounts: {
        available: availableCars,
        rented: rentedCars,
        maintenance: carsInMaintenance,
      },
      upcomingToday,
      upcomingTomorrow,
      topCars,
      cancellationRate,
      mostRentedCar,
      peakBookingDay,
      averageRentalDurationDays,
      notifications,
    };
  }, [cars, reservationStats.cancelled, reservationStats.pending, reservations]);

  const revenueChartData = revenueWindow === 7 ? dashboardAnalytics.revenueLast7 : dashboardAnalytics.revenueLast30;

  const revenueCards = useMemo(() => {
    const dailyTrend = dashboardAnalytics.revenueToday - dashboardAnalytics.revenueYesterday;
    const weeklyTrend = dashboardAnalytics.revenueWeek - dashboardAnalytics.revenuePreviousWeek;
    const monthlyTrend = dashboardAnalytics.revenueMonth - dashboardAnalytics.revenuePreviousMonth;

    return [
      {
        key: "today",
        label: "Revenue Today",
        value: dashboardAnalytics.revenueToday,
        trend: dailyTrend,
        icon: TrendingUp,
      },
      {
        key: "week",
        label: "Revenue This Week",
        value: dashboardAnalytics.revenueWeek,
        trend: weeklyTrend,
        icon: CalendarClock,
      },
      {
        key: "month",
        label: "Revenue This Month",
        value: dashboardAnalytics.revenueMonth,
        trend: monthlyTrend,
        icon: Gauge,
      },
      {
        key: "pending",
        label: "Pending Payments",
        value: dashboardAnalytics.pendingPayments,
        trend: 0,
        icon: CreditCard,
      },
    ];
  }, [dashboardAnalytics]);

  const clearForm = () => {
    setFormState(createEmptyFormState());
    setEditingSlug(null);
    setEditingRemoteId(null);
  };

  const prefillLuxuryTemplate = () => {
    setFormState({
      brand: "Mercedes-Benz",
      model: "Classe E 220d",
      category: "Business & Chauffeur",
      description: "Berline premium avec intérieur cuir, idéale pour les transferts exécutifs à Agadir et Marrakech.",
      pricePerDay: "950",
      transmission: "Automatique",
      fuel: "Diesel",
      seats: "5",
      image:
        "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1200&q=80",
      imageSecondary: "",
      imageThird: "",
      whatsappMessage: "Bonjour Julia Auto Cars, je souhaite réserver la Classe E avec chauffeur.",
      equipments: [
        "Intérieur cuir ventilé",
        "Chauffeur bilingue",
        "Wifi embarqué",
        "Chargeurs USB-C",
      ].join("\n"),
    });
    setEditingSlug(null);
    setEditingRemoteId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const filteredCars = useMemo(() => {
    const needle = search.toLowerCase();
    return cars.filter(
      (car) =>
        car.brand.toLowerCase().includes(needle) ||
        car.model.toLowerCase().includes(needle) ||
        car.category.toLowerCase().includes(needle),
    );
  }, [cars, search]);

  const stats = useMemo(() => {
    const total = cars.length;
    const avgPrice =
      total === 0 ? 0 : Math.round(cars.reduce((sum, car) => sum + car.pricePerDay, 0) / total);
    const automaticShare =
      total === 0
        ? 0
        : Math.round(
            (cars.filter((car) => car.transmission.toLowerCase().includes("auto")).length / total) *
              100,
          );

    return { total, avgPrice, automaticShare };
  }, [cars]);

  const syncLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date()),
    [],
  );

  const todayIso = useMemo(() => new Date().toISOString().split("T")[0], []);

  useEffect(() => {
    if (adminEmail) {
      setEmailForm((previous) => ({ ...previous, currentEmail: adminEmail }));
    }
  }, [adminEmail]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "cars" || tab === "reservations" || tab === "account") {
      setActiveSection(tab);
    }
  }, [searchParams]);

  const switchSection = (section: DashboardSection) => {
    setActiveSection(section);
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("tab", section);
      return next;
    });
  };

  const fetchReservations = useCallback(async () => {
    setReservationsLoading(true);
    try {
      const { data } = await apiClient.get<ReservationRecord[]>("/reservations");
      setReservations(data);
      setReservationsError(null);
    } catch (reservationsFetchError) {
      console.error("Impossible de charger les réservations", reservationsFetchError);
      setReservationsError("Impossible de charger les réservations.");
    } finally {
      setReservationsLoading(false);
    }
  }, []);

  const handleQuickReservationSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!quickReservationForm.carId) {
      toast({
        title: "Véhicule requis",
        description: "Sélectionnez un véhicule pour créer une réservation.",
        variant: "destructive",
      });
      return;
    }
    setQuickReservationLoading(true);
    try {
      await apiClient.post("/reservations", {
        carId: Number(quickReservationForm.carId),
        firstName: quickReservationForm.firstName.trim(),
        lastName: quickReservationForm.lastName.trim(),
        email: quickReservationForm.email.trim().toLowerCase(),
        phone: quickReservationForm.phone.trim(),
        documentId: quickReservationForm.documentId.trim(),
        pickupCity: quickReservationForm.pickupCity.trim(),
        pickupDate: quickReservationForm.pickupDate,
        returnCity: quickReservationForm.returnCity.trim(),
        returnDate: quickReservationForm.returnDate,
        notes: quickReservationForm.notes.trim() || undefined,
        extras: [],
      });
      toast({
        title: "Réservation créée",
        description: "La nouvelle réservation a été ajoutée avec succès.",
      });
      setQuickReservationOpen(false);
      setQuickReservationForm({
        carId: "",
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        documentId: "",
        pickupCity: "Agadir",
        pickupDate: "",
        returnCity: "Agadir",
        returnDate: "",
        notes: "",
      });
      await fetchReservations();
      switchSection("reservations");
      window.setTimeout(() => {
        document.getElementById("reservations-board")?.scrollIntoView({ behavior: "smooth" });
      }, 120);
    } catch (creationError) {
      toast({
        title: "Création impossible",
        description: resolveFriendlyError(creationError, {
          defaultMessage: "Impossible de créer la réservation. Vérifiez les informations et réessayez.",
        }),
        variant: "destructive",
      });
    } finally {
      setQuickReservationLoading(false);
    }
  };

  const handleQuickVehicleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setQuickVehicleLoading(true);
    try {
      const payload = buildCarRecord(
        {
          brand: quickCarForm.brand,
          model: quickCarForm.model,
          category: quickCarForm.category,
          description: `Véhicule ajouté rapidement depuis le centre de commandes (${new Date().toLocaleDateString("fr-FR")}).`,
          pricePerDay: quickCarForm.pricePerDay,
          transmission: quickCarForm.transmission,
          fuel: quickCarForm.fuel,
          seats: quickCarForm.seats,
          image: quickCarForm.image,
          imageSecondary: "",
          imageThird: "",
          whatsappMessage: "",
          equipments: "Climatisation\nBluetooth",
        },
      );
      await addCar(payload);
      toast({
        title: "Véhicule créé",
        description: `${payload.brand} ${payload.model} est ajouté à la flotte.`,
      });
      setQuickVehicleOpen(false);
      setQuickCarForm({
        brand: "",
        model: "",
        category: "SUV",
        pricePerDay: "",
        transmission: "Automatique",
        fuel: "Diesel",
        seats: "5",
        image: "",
      });
      switchSection("cars");
      window.setTimeout(() => {
        document.getElementById("cars-board")?.scrollIntoView({ behavior: "smooth" });
      }, 120);
    } catch (creationError) {
      toast({
        title: "Ajout impossible",
        description: resolveFriendlyError(creationError, {
          defaultMessage: "Impossible d'ajouter ce véhicule pour le moment.",
        }),
        variant: "destructive",
      });
    } finally {
      setQuickVehicleLoading(false);
    }
  };

  const handleQuickCustomerRoute = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams();
    params.set("source", "admin");
    params.set("firstName", quickCustomerForm.firstName.trim());
    params.set("lastName", quickCustomerForm.lastName.trim());
    params.set("email", quickCustomerForm.email.trim());
    params.set("phone", quickCustomerForm.phone.trim());
    setQuickCustomerOpen(false);
    navigate(`/reservation?${params.toString()}`);
  };

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  const handleEmailSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const currentEmail = (emailForm.currentEmail || adminEmail || "").trim().toLowerCase();
    const newEmail = emailForm.newEmail.trim().toLowerCase();
    setEmailFeedback(null);
    setEmailLoading(true);
    try {
      if (!currentEmail || !newEmail) {
        throw new Error("Merci de renseigner les emails actuel et nouveau.");
      }
      await apiClient.post("/auth/change-email", {
        currentEmail,
        newEmail,
        currentPassword: emailForm.password,
      });
      let sessionRefreshed = true;
      try {
        await login({ email: newEmail, password: emailForm.password });
      } catch (refreshError) {
        sessionRefreshed = false;
        console.warn("Impossible de rafraîchir la session après changement d'email", refreshError);
      }
      setEmailFeedback({
        tone: sessionRefreshed ? "success" : "warning",
        message: sessionRefreshed
          ? "Email principal mis à jour."
          : "Email mis à jour. Veuillez vous reconnecter pour continuer.",
      });
      if (sessionRefreshed) {
        updateUser({ email: newEmail, id: newEmail });
      }
      setEmailForm({ currentEmail: newEmail, newEmail: "", password: "" });
    } catch (accountError) {
      setEmailFeedback({ tone: "error", message: resolveAccountError(accountError) });
    } finally {
      setEmailLoading(false);
    }
  };

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordFeedback({ tone: "error", message: "Les nouveaux mots de passe ne correspondent pas." });
      return;
    }
    if (passwordForm.newPassword.trim().length < 12) {
      setPasswordFeedback({ tone: "error", message: "Le nouveau mot de passe doit contenir au moins 12 caractères." });
      return;
    }
    setPasswordFeedback(null);
    setPasswordLoading(true);
    try {
      const normalizedEmail = (emailForm.currentEmail || adminEmail).trim();
      await apiClient.post("/auth/change-password", {
        email: normalizedEmail,
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword.trim(),
      });
      setPasswordFeedback({ tone: "success", message: "Mot de passe mis à jour." });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (accountError) {
      setPasswordFeedback({ tone: "error", message: resolveAccountError(accountError) });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedBrand = formState.brand.trim();
    const trimmedModel = formState.model.trim();
    const coverImage = formState.image.trim();
    if (!trimmedBrand || !trimmedModel || !coverImage) {
      toast({
        title: "Ce champ est requis",
        description: "Renseignez la marque, le modèle et l'image principale avant d'enregistrer.",
        variant: "destructive",
      });
      return;
    }

    setPendingAction(true);
    try {
      if (editingSlug) {
        if (editingRemoteId == null) {
          toast({
            title: "Action indisponible",
            description: "Cette voiture n'est pas encore reliée au serveur central.",
            variant: "destructive",
          });
          return;
        }
        const existingCar = cars.find((car) => car.remoteId === editingRemoteId);
        if (!existingCar) {
          toast({
            title: "Voiture introuvable",
            description: "Rechargez le tableau de bord puis réessayez",
            variant: "destructive",
          });
          return;
        }
        const payload = buildCarRecord(formState, existingCar);
        await updateCar(editingRemoteId, payload);
        toast({
          title: "Fiche mise à jour",
          description: `${payload.brand} ${payload.model} est à jour dans le catalogue.`,
        });
      } else {
        const payload = buildCarRecord(formState);
        await addCar(payload);
        toast({
          title: "Voiture publiée",
          description: `${payload.brand} ${payload.model} est disponible pour vos équipes.`,
        });
      }

      clearForm();
    } catch (actionError) {
      console.error("Impossible d'enregistrer la voiture", actionError);
      toast({
        title: "Impossible d'enregistrer",
        description: resolveFriendlyError(actionError, {
          defaultMessage: "Serveur injoignable. Vérifiez vos informations puis réessayez.",
        }),
        variant: "destructive",
      });
    } finally {
      setPendingAction(false);
    }
  };

  const handleEdit = (car: CarDetail) => {
    if (car.remoteId == null) {
      toast({
        title: "Modification impossible",
        description:
          "Cette voiture provient des données locales. Synchronisez-la avant de pouvoir la modifier.",
        variant: "destructive",
      });
      return;
    }
    setEditingSlug(car.id);
    setEditingRemoteId(car.remoteId);
    setFormState({
      brand: car.brand,
      model: car.model,
      category: car.category,
      description: car.description,
      pricePerDay: String(car.pricePerDay),
      transmission: car.transmission,
      fuel: car.fuel,
      seats: String(car.seats),
      image: car.image,
      imageSecondary: car.gallery?.[1]?.image ?? "",
      imageThird: car.gallery?.[2]?.image ?? "",
      whatsappMessage: car.whatsappMessage,
      equipments: car.equipments.join("\n"),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = (car: CarDetail) => {
    if (car.remoteId == null) {
      toast({
        title: "Suppression bloquée",
        description: "Synchronisez ce véhicule avant de pouvoir le supprimer.",
        variant: "destructive",
      });
      return;
    }
    setConfirmDialog({ type: "car-delete", car });
  };

  const handleReset = () => {
    setConfirmDialog({ type: "fleet-reset" });
  };

  const handleConfirmReservation = async (reservationId: number) => {
    setReservationProcessing(reservationId);
    try {
      await apiClient.post(`/reservations/${reservationId}/confirm`);
      toast({ title: "Réservation confirmée", description: `Réservation #${reservationId} validée.` });
      await fetchReservations();
    } catch (confirmError) {
      console.error("Erreur lors de la confirmation", confirmError);
      toast({ title: "Erreur", description: "Impossible de confirmer la réservation.", variant: "destructive" });
    } finally {
      setReservationProcessing(null);
    }
  };

  const handleCancelReservation = async (reservationId: number) => {
    const reason = window.prompt("Motif de l'annulation", "Annulé depuis le back-office");
    if (reason == null) {
      return;
    }
    setReservationProcessing(reservationId);
    try {
      await apiClient.post(`/reservations/${reservationId}/cancel`, null, { params: { reason } });
      toast({ title: "Réservation annulée", description: `Réservation #${reservationId} annulée.` });
      await fetchReservations();
    } catch (cancelError) {
      console.error("Erreur lors de l'annulation", cancelError);
      toast({ title: "Erreur", description: "Impossible d'annuler la réservation.", variant: "destructive" });
    } finally {
      setReservationProcessing(null);
    }
  };

  const handleDeleteReservation = (reservation: ReservationRecord) => {
    setConfirmDialog({ type: "reservation-delete", reservation });
  };

  const handleViewReservation = (reservation: ReservationRecord) => {
    setSelectedReservation(reservation);
    setDetailsOpen(true);
  };

  const openReservationsExportDialog = () => {
    setExportPeriodMode("all");
    setExportStartDate("");
    setExportEndDate("");
    setExportReservationsOpen(true);
  };

  const handleExportReservationsExcel = () => {
    const reservationsToExport = buildReservationsForExport();

    if (reservationsToExport === null) {
      toast({
        title: "Période invalide",
        description: "Sélectionnez une période valide avant d'exporter.",
        variant: "destructive",
      });
      return;
    }

    if (reservationsToExport.length === 0) {
      const message = reservationStatusFilter
        ? `Aucune réservation trouvée avec le statut: ${reservationStatusFilter}`
        : "Ajoutez des réservations avant d'exporter.";
      toast({
        title: "Aucune réservation",
        description: message,
        variant: "destructive",
      });
      return;
    }

    const headers = [
      "Reservation ID",
      "Statut",
      "Client",
      "Email",
      "Telephone",
      "Pickup City",
      "Pickup Date",
      "Return City",
      "Return Date",
      "Vehicle",
      "Total (DH)",
      "Google Maps Pickup",
    ];

    const rows = reservationsToExport.map((reservation) => {
      const relatedCar = cars.find((car) => car.remoteId === reservation.carId);
      const vehicleLabel = relatedCar ? `${relatedCar.brand} ${relatedCar.model}` : `ID ${reservation.carId}`;
      return [
        reservation.id,
        reservation.status,
        `${reservation.customerFirstName} ${reservation.customerLastName}`,
        reservation.customerEmail,
        reservation.customerPhone,
        reservation.pickupCity,
        reservation.pickupDate,
        reservation.returnCity,
        reservation.returnDate,
        vehicleLabel,
        getDisplayTotalAmount(reservation),
        buildGoogleMapsSearchUrl(reservation.pickupCity),
      ];
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const colWidths = [12, 15, 20, 20, 15, 15, 15, 15, 15, 20, 12, 35];
    worksheet["!cols"] = colWidths.map((w) => ({ wch: w }));
    const headerStyle = {
      fill: { fgColor: { rgb: "FF0F172A" } },
      font: { bold: true, color: { rgb: "FFFFFFFF" } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: {
        top: { style: "thin", color: { rgb: "FF1E293B" } },
        bottom: { style: "thin", color: { rgb: "FF1E293B" } },
        left: { style: "thin", color: { rgb: "FF1E293B" } },
        right: { style: "thin", color: { rgb: "FF1E293B" } },
      },
    };

    const bodyStyles = ["FFF8FAFC", "FFFFFFFF"];
    for (let i = 0; i < headers.length; i += 1) {
      const headerCell = `${XLSX.utils.encode_col(i)}1`;
      if (worksheet[headerCell]) {
        worksheet[headerCell].s = headerStyle;
      }
    }

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      for (let colIndex = 0; colIndex < headers.length; colIndex += 1) {
        const cellAddress = `${XLSX.utils.encode_col(colIndex)}${rowIndex + 2}`;
        const cell = worksheet[cellAddress];
        if (!cell) continue;

        cell.s = {
          fill: { fgColor: { rgb: bodyStyles[rowIndex % 2] } },
          font: { color: { rgb: "FF0F172A" } },
          alignment: { horizontal: colIndex === 11 ? "left" : "center", vertical: "center", wrapText: true },
          border: {
            top: { style: "thin", color: { rgb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { rgb: "FFE2E8F0" } },
            left: { style: "thin", color: { rgb: "FFE2E8F0" } },
            right: { style: "thin", color: { rgb: "FFE2E8F0" } },
          },
        };
      }
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Reservations");

    const exportDate = new Date().toISOString().split("T")[0];
    const filterSuffix = reservationStatusFilter ? `-${reservationStatusFilter.toLowerCase()}` : "";
    const periodSuffix =
      exportPeriodMode === "range" ? `-${exportStartDate}-to-${exportEndDate}` : "-all-data";
    const filename = `reservations${filterSuffix}${periodSuffix}-${exportDate}.xlsx`;

    XLSX.writeFile(workbook, filename);
    setExportReservationsOpen(false);

    toast({
      title: "Export réussi",
      description: `${reservationsToExport.length} réservation(s) exportée(s) en XLSX.`,
    });
  };

  const deleteCarRecord = async (car: CarDetail) => {
    if (car.remoteId == null) {
      toast({
        title: "Suppression bloquée",
        description: "Synchronisez ce véhicule avant de pouvoir le supprimer.",
        variant: "destructive",
      });
      throw new Error("Unsynced car");
    }
    try {
      await deleteCar(car.remoteId);
      toast({
        title: "Voiture supprimée",
        description: `${car.brand} ${car.model} a quitté le catalogue connecté.`,
      });
    } catch (deleteError) {
      console.error("Suppression impossible", deleteError);
      toast({
        title: "Suppression impossible",
        description: "Le serveur n'a pas pu retirer ce véhicule. Réessayez dans un instant.",
        variant: "destructive",
      });
      throw deleteError;
    }
  };

  const deleteReservationRecord = async (reservationId: number) => {
    setReservationProcessing(reservationId);
    try {
      await apiClient.delete(`/reservations/${reservationId}`);
      toast({ title: "Réservation supprimée", description: `Réservation #${reservationId} supprimée.` });
      await fetchReservations();
    } catch (deleteError) {
      console.error("Erreur lors de la suppression", deleteError);
      toast({ title: "Erreur", description: "Impossible de supprimer la réservation.", variant: "destructive" });
      throw deleteError;
    } finally {
      setReservationProcessing(null);
    }
  };

  const resetFleetData = async () => {
    setResetting(true);
    try {
      await resetCars();
      clearForm();
      toast({
        title: "Flotte restaurée",
        description: "La configuration de démonstration est de nouveau en ligne.",
      });
    } catch (resetError) {
      console.error("Erreur lors de la restauration", resetError);
      toast({
        title: "Restauration impossible",
        description: "Le serveur n'a pas pu réinitialiser la flotte. Réessayez plus tard.",
        variant: "destructive",
      });
      throw resetError;
    } finally {
      setResetting(false);
    }
  };

  const confirmDialogCopy = useMemo<ConfirmDialogCopy | null>(() => {
    if (!confirmDialog) {
      return null;
    }
    switch (confirmDialog.type) {
      case "car-delete":
        return {
          title: "Supprimer ce véhicule ?",
          description: `La ${confirmDialog.car.brand} ${confirmDialog.car.model} sera retirée du catalogue connecté.`,
          confirmLabel: "Supprimer",
          tone: "destructive",
        };
      case "reservation-delete":
        return {
          title: `Supprimer la réservation du ${confirmDialog.reservation.customerFirstName} ?`,
          description: `${confirmDialog.reservation.customerFirstName} ${confirmDialog.reservation.customerLastName} ne figurera plus dans la liste et les créneaux seront libérés.`,
          confirmLabel: "Supprimer",
          tone: "destructive",
        };
      case "fleet-reset":
        return {
          title: "Restaurer la flotte par défaut ?",
          description: "Tous les véhicules personnalisés seront remplacés par la configuration de démonstration.",
          confirmLabel: "Restaurer",
          tone: "primary",
        };
      default:
        return null;
    }
  }, [confirmDialog]);

  const closeConfirmDialog = () => {
    if (confirmingAction) {
      return;
    }
    setConfirmDialog(null);
  };

  const executeConfirmDialog = async () => {
    if (!confirmDialog) {
      return;
    }
    setConfirmingAction(true);
    let shouldClose = true;
    try {
      if (confirmDialog.type === "car-delete") {
        await deleteCarRecord(confirmDialog.car);
      } else if (confirmDialog.type === "reservation-delete") {
        await deleteReservationRecord(confirmDialog.reservation.id);
      } else {
        await resetFleetData();
      }
    } catch (actionError) {
      shouldClose = false;
    } finally {
      setConfirmingAction(false);
      if (shouldClose) {
        setConfirmDialog(null);
      }
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-[1600px] gap-6 px-4 py-4 lg:px-6">
        <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-72 shrink-0 flex-col rounded-[28px] border border-border bg-card px-5 py-6 shadow-[0_12px_40px_rgba(15,23,42,0.06)] lg:flex">
          <div className="border-b border-white/10 pb-5">
            <p className="text-xs uppercase tracking-[0.45em] text-muted-foreground">Julia Auto Cars</p>
            <p className="mt-2 text-2xl font-display font-semibold text-foreground">Command Center</p>
            <p className="mt-1 text-sm text-muted-foreground">Stay on top of key metrics across your business.</p>
          </div>
          <div className="mt-5 space-y-2 border-b border-white/10 pb-5">
            <button
              type="button"
              onClick={() => scrollToPanel("overview-panel")}
              className="flex w-full items-center gap-3 rounded-2xl bg-primary/10 px-4 py-3 text-left text-sm font-semibold text-primary"
            >
              <Home className="h-4 w-4" />
              Overview
            </button>
            <button
              type="button"
              onClick={() => scrollToPanel("insights-panel")}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium text-foreground hover:bg-secondary/40"
            >
              <Lightbulb className="h-4 w-4" />
              Insights
            </button>
          </div>
          <nav className="mt-6 flex flex-1 flex-col gap-1">
            {dashboardNav.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => switchSection(item.key)}
                className={`rounded-2xl px-4 py-3 text-left transition ${
                  activeSection === item.key
                    ? "border border-primary/30 bg-primary/10 text-primary shadow-sm"
                    : "border border-transparent text-foreground hover:border-border hover:bg-secondary/40"
                }`}
              >
                <p className="text-sm font-semibold">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </button>
            ))}
          </nav>
          <div className="rounded-2xl border border-border bg-secondary/40 p-4 text-xs text-muted-foreground">
            <p className="text-sm font-semibold text-foreground">Dernière synchronisation</p>
            <p className="mt-1 text-sm text-foreground">{syncLabel}</p>
          </div>
        </aside>

        <div className="flex-1 space-y-6">
        <section id="overview-panel" className="rounded-[40px] border border-white/10 bg-gradient-to-br from-[#0b1120] via-[#050714] to-[#010309] p-8 shadow-[0_35px_120px_rgba(3,7,18,0.65)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Vue générale</p>
              <h1 className="text-3xl font-display font-bold text-foreground md:text-4xl">Centre de commandes</h1>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                Gardez un œil en un coup d'œil sur la flotte et les demandes reçues sans changer de section.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={fetchReservations}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-card px-4 py-2 text-sm font-semibold text-foreground hover:border-primary/40 hover:bg-primary/10"
              >
                <RefreshCcw className="h-4 w-4" /> Actualiser
              </button>
              <button
                type="button"
                onClick={() => setNavDrawerOpen(true)}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary/40 lg:hidden"
              >
                <Menu className="h-4 w-4" /> Menu
              </button>
              <button
                type="button"
                onClick={handleDashboardLogout}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary/40"
              >
                <LogOut className="h-4 w-4" /> Déconnexion
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-6 rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              {error}
            </div>
          )}

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
              <p className="mb-2 text-xs uppercase tracking-[0.4em] text-muted-foreground">Véhicules actifs</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-foreground">{stats.total}</span>
                <span className="text-sm text-muted-foreground">catalogue connecté</span>
              </div>
            </div>
            <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
              <p className="mb-2 text-xs uppercase tracking-[0.4em] text-muted-foreground">Panier moyen</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-foreground">{formatCurrency(stats.avgPrice)} DH</span>
                <span className="text-sm text-muted-foreground">/ jour</span>
              </div>
            </div>
            <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
              <p className="mb-2 text-xs uppercase tracking-[0.4em] text-muted-foreground">Automatique</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-foreground">{stats.automaticShare}%</span>
                <span className="text-sm text-muted-foreground">de la flotte</span>
              </div>
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {reservationOverview.map((metric) => (
              <div key={metric.key} className={`rounded-3xl border p-5 ${metric.cardClass}`}>
                <p className="mb-2 text-xs uppercase tracking-[0.4em] text-muted-foreground">{metric.label}</p>
                <p className={`text-3xl font-bold ${metric.valueClass}`}>{metric.value}</p>
                <p className="text-xs text-slate-400">{metric.helper}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {revenueCards.map((card) => {
              const TrendIcon = card.trend >= 0 ? ArrowUpRight : ArrowDownRight;
              const trendColor = card.trend >= 0 ? "text-emerald-300" : "text-rose-300";
              const CardIcon = card.icon;
              return (
                <div
                  key={card.key}
                  className="group rounded-3xl border border-border bg-card p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-primary/40"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">{card.label}</p>
                    <CardIcon className="h-4 w-4 text-blue-500" />
                  </div>
                  <p className="text-3xl font-bold text-foreground">{formatCurrency(card.value)} DH</p>
                  <p className={`mt-2 inline-flex items-center gap-1 text-xs ${trendColor}`}>
                    <TrendIcon className="h-3.5 w-3.5" />
                    {card.key === "pending"
                      ? "Encaissements en attente"
                      : `${card.trend >= 0 ? "+" : ""}${formatCurrency(card.trend)} DH`}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-[1.6fr,1fr]">
            <div className="rounded-[30px] border border-border bg-card p-6 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Revenue Evolution</p>
                  <h3 className="text-xl font-display font-semibold text-foreground">Last 7 days / Last 30 days</h3>
                  <p className="text-xs text-muted-foreground">Semaine: {formatCurrency(dashboardAnalytics.revenueWeek)} DH • Mois: {formatCurrency(dashboardAnalytics.revenueMonth)} DH • Année: {formatCurrency(dashboardAnalytics.revenueYear)} DH</p>
                </div>
                <div className="inline-flex rounded-full border border-border bg-secondary/40 p-1 text-xs text-foreground">
                  <button
                    type="button"
                    onClick={() => setRevenueWindow(7)}
                    className={`rounded-full px-3 py-1.5 transition ${
                      revenueWindow === 7 ? "bg-primary/100 text-white" : "text-foreground hover:bg-card"
                    }`}
                  >
                    7 jours
                  </button>
                  <button
                    type="button"
                    onClick={() => setRevenueWindow(30)}
                    className={`rounded-full px-3 py-1.5 transition ${
                      revenueWindow === 30 ? "bg-primary/100 text-white" : "text-foreground hover:bg-card"
                    }`}
                  >
                    30 jours
                  </button>
                </div>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer>
                  <LineChart data={revenueChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 4" stroke="rgba(148,163,184,0.2)" />
                    <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                    <YAxis
                      stroke="#94a3b8"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => `${Math.round(value / 1000)}k`}
                    />
                    <Tooltip
                      cursor={{ stroke: "rgba(59,130,246,0.35)", strokeWidth: 1 }}
                      formatter={(value) => `${formatCurrency(Number(value))} DH`}
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid rgba(255,255,255,0.15)",
                        background: "rgba(15,23,42,0.96)",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#22d3ee"
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 5, stroke: "#67e8f9", strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-[30px] border border-border bg-card p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Fleet Status</p>
              <h3 className="text-xl font-display font-semibold text-foreground">Fleet Utilization</h3>
              <div className="mt-4 h-56">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={dashboardAnalytics.fleetStatusData}
                      dataKey="value"
                      nameKey="label"
                      innerRadius={62}
                      outerRadius={86}
                      paddingAngle={4}
                    >
                      {dashboardAnalytics.fleetStatusData.map((entry) => (
                        <Cell key={entry.label} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [`${value}`, `${name}`]}
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid rgba(255,255,255,0.15)",
                        background: "rgba(15,23,42,0.96)",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid gap-2 text-sm text-foreground">
                <p className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 px-3 py-2">
                  <span>Available</span>
                  <span className="font-semibold">{dashboardAnalytics.fleetCounts.available}</span>
                </p>
                <p className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 px-3 py-2">
                  <span>Rented</span>
                  <span className="font-semibold">{dashboardAnalytics.fleetCounts.rented}</span>
                </p>
                <p className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 px-3 py-2">
                  <span>Maintenance</span>
                  <span className="font-semibold">{dashboardAnalytics.fleetCounts.maintenance}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-[1.4fr,1fr]">
            <div className="rounded-[30px] border border-border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Prochaines Réservations</p>
                  <h3 className="text-xl font-display font-semibold">Aujourd'hui et demain</h3>
                </div>
                <Clock3 className="h-5 w-5 text-cyan-200" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-border bg-secondary/40 p-4">
                  <p className="mb-2 text-xs uppercase tracking-[0.3em] text-slate-400">Today</p>
                  <div className="space-y-2 text-sm">
                    {dashboardAnalytics.upcomingToday.length === 0 ? (
                      <p className="text-slate-400">Aucune réservation prévue.</p>
                    ) : (
                      dashboardAnalytics.upcomingToday.slice(0, 3).map((item) => (
                        <div key={item.id} className="rounded-xl border border-border bg-card px-3 py-2">
                          <p className="font-semibold text-foreground">{item.carLabel}</p>
                          <p className="text-muted-foreground">{item.pickupTime} • {item.customer}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-secondary/40 p-4">
                  <p className="mb-2 text-xs uppercase tracking-[0.3em] text-slate-400">Tomorrow</p>
                  <div className="space-y-2 text-sm">
                    {dashboardAnalytics.upcomingTomorrow.length === 0 ? (
                      <p className="text-slate-400">Aucune réservation prévue.</p>
                    ) : (
                      dashboardAnalytics.upcomingTomorrow.slice(0, 3).map((item) => (
                        <div key={item.id} className="rounded-xl border border-border bg-card px-3 py-2">
                          <p className="font-semibold text-foreground">{item.carLabel}</p>
                          <p className="text-muted-foreground">{item.pickupTime} • {item.customer}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-[30px] border border-border bg-card p-6 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Notifications</p>
                  <BellRing className="h-4 w-4 text-blue-500" />
                </div>
                <div className="space-y-2 text-sm">
                  {dashboardAnalytics.notifications.map((notification) => (
                    <p
                      key={notification.id}
                      className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-foreground"
                    >
                      {notification.text}
                    </p>
                  ))}
                </div>
              </div>

              <div className="rounded-[30px] border border-border bg-card p-6 shadow-sm">
                <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Quick Actions</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <button
                    type="button"
                    onClick={() => setQuickReservationOpen(true)}
                    className="rounded-xl border border-border bg-secondary/40 px-3 py-2 text-left text-foreground transition hover:border-primary/40 hover:bg-primary/10"
                  >
                    Add Reservation
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickVehicleOpen(true)}
                    className="rounded-xl border border-border bg-secondary/40 px-3 py-2 text-left text-foreground transition hover:border-primary/40 hover:bg-primary/10"
                  >
                    Add Car
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickCustomerOpen(true)}
                    className="rounded-xl border border-border bg-secondary/40 px-3 py-2 text-left text-foreground transition hover:border-primary/40 hover:bg-primary/10"
                  >
                    Add Customer
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      switchSection("reservations");
                      window.setTimeout(() => {
                        document.getElementById("reservations-board")?.scrollIntoView({ behavior: "smooth" });
                      }, 120);
                    }}
                    className="rounded-xl border border-border bg-secondary/40 px-3 py-2 text-left text-foreground transition hover:border-primary/40 hover:bg-primary/10"
                  >
                    View Calendar
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div id="insights-panel" className="mt-8 grid gap-6 xl:grid-cols-3">
            <div className="rounded-[30px] border border-border bg-card p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Top véhicules loués</p>
              <h3 className="text-xl font-display font-semibold">Top Performing Cars</h3>
              <ol className="mt-4 space-y-2 text-sm">
                {dashboardAnalytics.topCars.length === 0 ? (
                  <li className="rounded-xl border border-border bg-secondary/40 px-3 py-2 text-slate-400">
                    Aucune donnée pour le moment.
                  </li>
                ) : (
                  dashboardAnalytics.topCars.map((car, index) => (
                    <li
                      key={car.name}
                      className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 px-3 py-2"
                    >
                      <span>{index + 1}. {car.name}</span>
                      <span className="text-blue-600">{car.bookings} bookings</span>
                    </li>
                  ))
                )}
              </ol>
            </div>

            <div className="rounded-[30px] border border-border bg-card p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Cancellation Rate</p>
              <p className="mt-2 text-4xl font-bold text-rose-600">{dashboardAnalytics.cancellationRate}%</p>
              <p className="mt-2 text-sm text-muted-foreground">Taux d'annulation sur l'ensemble des demandes.</p>
              <div className="mt-5 h-40">
                <ResponsiveContainer>
                  <BarChart
                    data={[
                      {
                        label: "Annulations",
                        value: dashboardAnalytics.cancellationRate,
                      },
                    ]}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                    <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                    <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} domain={[0, 100]} />
                    <Tooltip formatter={(value) => `${value}%`} />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#fb7185" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-[30px] border border-border bg-card p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Insights</p>
              <h3 className="text-xl font-display font-semibold">Smart Insights</h3>
              <ul className="mt-4 space-y-2 text-sm text-foreground">
                <li className="flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2">
                  <CarFront className="h-4 w-4 text-emerald-500" />
                  Most rented car: {dashboardAnalytics.mostRentedCar}
                </li>
                <li className="flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2">
                  <CalendarClock className="h-4 w-4 text-blue-500" />
                  Peak booking day: {dashboardAnalytics.peakBookingDay}
                </li>
                <li className="flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2">
                  <Wrench className="h-4 w-4 text-amber-500" />
                  Average rental duration: {dashboardAnalytics.averageRentalDurationDays} days
                </li>
              </ul>
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[260px,1fr] lg:items-start lg:gap-10">
          <aside className="hidden">
            <div className="border-b border-white/5 pb-5">
              <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Julia Auto Cars</p>
              <p className="text-lg font-display font-semibold text-white">Espace admin</p>
              <p className="text-xs text-slate-400">Pilotage temps réel</p>
            </div>
            <nav className="mt-6 flex flex-1 flex-col gap-2">
              {dashboardNav.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => switchSection(item.key)}
                  className={`rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                    activeSection === item.key
                      ? "border border-white/20 bg-card/10 text-white shadow-[0_10px_30px_rgba(15,23,42,0.45)]"
                      : "border border-white/5 bg-transparent text-slate-300 hover:border-white/20 hover:bg-card/5"
                  }`}
                >
                  <p>{item.label}</p>
                  <p className="text-xs font-normal text-slate-400">{item.description}</p>
                </button>
              ))}
            </nav>
            <div className="mt-6 rounded-2xl border border-white/10 bg-card/5 p-4 text-xs text-slate-300">
              <p className="text-white">Dernière synchronisation</p>
              <p className="text-sm font-semibold text-white">{syncLabel}</p>
              <p className="text-slate-400">Flux flotte & réservations</p>
            </div>
          </aside>

          <section className="flex-1 space-y-10 lg:col-span-2">
            {activeSection === "cars" && (
              <>
                <section className="grid gap-6 lg:grid-cols-[0.85fr,1.15fr]">
              <div className="space-y-6">
                <div className="rounded-[32px] border border-border bg-card p-6 shadow-sm">
                  <div className="mb-4">
                    <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Centre opérationnel</p>
                    <h2 className="text-2xl font-display font-semibold text-foreground">Actions rapides</h2>
                  </div>
                  <div className="grid gap-3">
                    <button
                      type="button"
                      onClick={prefillLuxuryTemplate}
                      className="inline-flex items-center justify-between rounded-2xl border border-border bg-secondary/40 px-4 py-3 text-sm font-semibold text-foreground transition hover:border-primary/40 hover:bg-primary/10"
                    >
                      Pré-remplir une fiche Business
                      <PlusCircle className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={clearForm}
                      className="inline-flex items-center justify-between rounded-2xl border border-border px-4 py-3 text-sm text-foreground hover:border-primary/40 hover:bg-secondary/40"
                    >
                      Nettoyer le formulaire
                      <Wand2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="rounded-[32px] border border-border bg-card p-6 shadow-sm">
                  <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Fiches actives</p>
                      <h2 className="text-2xl font-display font-semibold">Dernières voitures</h2>
                    </div>
                    <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                      {cars.length} au total
                    </span>
                  </div>
                  <div className="space-y-3">
                    {highlightedCars.length === 0 ? (
                      <p className="text-sm text-slate-400">Ajoutez votre première voiture pour la voir ici.</p>
                    ) : (
                      highlightedCars.map((car) => (
                        <button
                          key={car.id}
                          type="button"
                          onClick={() => handleEdit(car)}
                          className="w-full rounded-2xl border border-border bg-secondary/40 px-4 py-3 text-left text-sm text-foreground transition hover:border-primary/40 hover:bg-primary/10"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-foreground">{car.brand} {car.model}</p>
                              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{car.slug}</p>
                            </div>
                            <p className="text-xs text-muted-foreground">{car.pricePerDay} DH/j</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <form
                onSubmit={handleSubmit}
                className="rounded-[32px] border border-border bg-card p-8 shadow-sm"
              >
                <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">
                      {editingSlug ? "Edition" : "Nouveau"}
                    </p>
                    <h2 className="text-2xl font-display font-semibold text-foreground">
                      {editingSlug ? "Mettre à jour" : "Enregistrer"} une voiture
                    </h2>
                  </div>
                  {editingSlug && (
                    <button
                      type="button"
                      className="text-sm text-blue-600 underline"
                      onClick={clearForm}
                    >
                      Annuler l'édition
                    </button>
                  )}
                </div>

                <div className="grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-2 text-sm text-foreground">
                      Marque
                      <input
                        className="w-full rounded-2xl border border-border bg-secondary/40 px-4 py-2.5 text-foreground focus:border-blue-300 focus:outline-none"
                        value={formState.brand}
                        onChange={(event) => setFormState((prev) => ({ ...prev, brand: event.target.value }))}
                        required
                      />
                    </label>
                    <label className="space-y-2 text-sm text-foreground">
                      Modèle
                      <input
                        className="w-full rounded-2xl border border-border bg-secondary/40 px-4 py-2.5 text-foreground focus:border-blue-300 focus:outline-none"
                        value={formState.model}
                        onChange={(event) => setFormState((prev) => ({ ...prev, model: event.target.value }))}
                        required
                      />
                    </label>
                  </div>

                  <label className="space-y-2 text-sm text-foreground">
                    Catégorie
                    <input
                      className="w-full rounded-2xl border border-border bg-secondary/40 px-4 py-2.5 text-foreground focus:border-blue-300 focus:outline-none"
                      value={formState.category}
                      onChange={(event) => setFormState((prev) => ({ ...prev, category: event.target.value }))}
                    />
                  </label>

                  <label className="space-y-2 text-sm text-foreground">
                    Description courte
                    <textarea
                      className="h-28 w-full rounded-2xl border border-border bg-secondary/40 px-4 py-2.5 text-foreground focus:border-blue-300 focus:outline-none"
                      value={formState.description}
                      onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
                    />
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-2 text-sm text-foreground">
                      Prix journalier (DH)
                      <input
                        type="number"
                        min="0"
                        className="w-full rounded-2xl border border-border bg-secondary/40 px-4 py-2.5 text-foreground focus:border-blue-300 focus:outline-none"
                        value={formState.pricePerDay}
                        onChange={(event) => setFormState((prev) => ({ ...prev, pricePerDay: event.target.value }))}
                        required
                      />
                    </label>
                    <label className="space-y-2 text-sm text-foreground">
                      Image (URL)
                      <input
                        type="url"
                        className="w-full rounded-2xl border border-border bg-secondary/40 px-4 py-2.5 text-foreground focus:border-blue-300 focus:outline-none"
                        value={formState.image}
                        onChange={(event) => setFormState((prev) => ({ ...prev, image: event.target.value }))}
                        required
                      />
                    </label>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Ajoutez jusqu'à 3 images. Les visuels supplémentaires sont optionnels.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-2 text-sm text-foreground">
                      Image secondaire (URL)
                      <input
                        type="url"
                        placeholder="Optionnel"
                        className="w-full rounded-2xl border border-border bg-secondary/40 px-4 py-2.5 text-foreground focus:border-blue-300 focus:outline-none"
                        value={formState.imageSecondary}
                        onChange={(event) =>
                          setFormState((prev) => ({ ...prev, imageSecondary: event.target.value }))
                        }
                      />
                    </label>
                    <label className="space-y-2 text-sm text-foreground">
                      Image 3 (URL)
                      <input
                        type="url"
                        placeholder="Optionnel"
                        className="w-full rounded-2xl border border-border bg-secondary/40 px-4 py-2.5 text-foreground focus:border-blue-300 focus:outline-none"
                        value={formState.imageThird}
                        onChange={(event) =>
                          setFormState((prev) => ({ ...prev, imageThird: event.target.value }))
                        }
                      />
                    </label>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <label className="space-y-2 text-sm text-foreground">
                      Transmission
                      <select
                        className="w-full rounded-2xl border border-border bg-secondary/40 px-4 py-2.5 text-foreground focus:border-blue-300 focus:outline-none"
                        value={formState.transmission}
                        onChange={(event) => setFormState((prev) => ({ ...prev, transmission: event.target.value }))}
                      >
                        <option value="Automatique">Automatique</option>
                        <option value="Manuelle">Manuelle</option>
                      </select>
                    </label>
                    <label className="space-y-2 text-sm text-foreground">
                      Carburant
                      <select
                        className="w-full rounded-2xl border border-border bg-secondary/40 px-4 py-2.5 text-foreground focus:border-blue-300 focus:outline-none"
                        value={formState.fuel}
                        onChange={(event) => setFormState((prev) => ({ ...prev, fuel: event.target.value }))}
                      >
                        <option value="Diesel">Diesel</option>
                        <option value="Essence">Essence</option>
                        <option value="Hybride">Hybride</option>
                        <option value="Électrique">Électrique</option>
                      </select>
                    </label>
                    <label className="space-y-2 text-sm text-foreground">
                      Places
                      <input
                        type="number"
                        min="2"
                        className="w-full rounded-2xl border border-border bg-secondary/40 px-4 py-2.5 text-foreground focus:border-blue-300 focus:outline-none"
                        value={formState.seats}
                        onChange={(event) => setFormState((prev) => ({ ...prev, seats: event.target.value }))}
                      />
                    </label>
                  </div>

                  <label className="space-y-2 text-sm text-foreground">
                    Message WhatsApp personnalisé
                    <input
                      className="w-full rounded-2xl border border-border bg-secondary/40 px-4 py-2.5 text-foreground focus:border-blue-300 focus:outline-none"
                      value={formState.whatsappMessage}
                      onChange={(event) => setFormState((prev) => ({ ...prev, whatsappMessage: event.target.value }))}
                    />
                  </label>

                  <label className="space-y-2 text-sm text-foreground">
                    Équipements (un par ligne)
                    <textarea
                      className="h-32 w-full rounded-2xl border border-border bg-secondary/40 px-4 py-2.5 text-foreground focus:border-blue-300 focus:outline-none"
                      value={formState.equipments}
                      onChange={(event) => setFormState((prev) => ({ ...prev, equipments: event.target.value }))}
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={pendingAction}
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 text-lg font-semibold text-primary-foreground shadow-[0_20px_45px_rgba(59,130,246,0.45)] transition hover:brightness-110 disabled:opacity-60"
                >
                  <PlusCircle className="h-5 w-5" />
                  {pendingAction ? "Traitement..." : editingSlug ? "Mettre à jour" : "Enregistrer"}
                </button>
              </form>
            </section>

            <section id="cars-board" className="rounded-[32px] border border-border bg-card p-6 shadow-sm">
              <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Inventaire</p>
                  <h2 className="text-2xl font-display font-semibold">Voitures connectées</h2>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                    {filteredCars.length} résultats / {cars.length}
                  </span>
                  <input
                    placeholder="Rechercher un modèle"
                    className="w-full rounded-2xl border border-border bg-secondary/40 px-4 py-2 text-sm text-foreground focus:border-blue-300 focus:outline-none sm:w-64"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="pb-3 font-semibold">Modèle</th>
                      <th className="pb-3 font-semibold">Catégorie</th>
                      <th className="pb-3 font-semibold">Prix</th>
                      <th className="pb-3 font-semibold">Transmission</th>
                      <th className="pb-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          Chargement de la flotte...
                        </td>
                      </tr>
                    ) : filteredCars.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-muted-foreground">
                          Aucun véhicule ne correspond à votre recherche.
                        </td>
                      </tr>
                    ) : (
                      filteredCars.map((car) => (
                        <tr key={car.id} className="border-t border-white/5">
                          <td className="py-3">
                            <div className="flex items-center gap-3">
                              <img src={car.image} alt={car.model} className="h-12 w-16 rounded-xl object-cover" />
                              <div>
                                <p className="font-semibold">
                                  {car.brand} {car.model}
                                </p>
                                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{car.slug}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 text-foreground">{car.category}</td>
                          <td className="py-3 text-foreground">{car.pricePerDay} DH</td>
                          <td className="py-3 text-foreground">{car.transmission}</td>
                          <td className="py-3">
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                disabled={car.remoteId == null}
                                className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-foreground hover:border-primary/40 disabled:opacity-50"
                                title={car.remoteId ? undefined : "Synchronisation requise"}
                                onClick={() => handleEdit(car)}
                              >
                                <Wand2 className="h-3 w-3" /> Modifier
                              </button>
                              <button
                                type="button"
                                disabled={car.remoteId == null}
                                className="inline-flex items-center gap-1 rounded-full border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                                title={car.remoteId ? undefined : "Synchronisation requise"}
                                onClick={() => handleDelete(car)}
                              >
                                <Trash2 className="h-3 w-3" /> Supprimer
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
              </>
            )}

            {activeSection === "reservations" && (
              <>
                <section id="reservations-analytics" className="rounded-[32px] border border-border bg-card p-6 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Réservations</p>
                  <h2 className="text-2xl font-display font-semibold">Pipeline en direct</h2>
                  <p className="text-sm text-slate-400">Synchronisées automatiquement depuis les demandes en ligne</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                    {reservations.length} demandes
                  </span>
                  <button
                    type="button"
                    onClick={fetchReservations}
                    className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary/40"
                  >
                    <RefreshCcw className="h-4 w-4" /> Rafraîchir
                  </button>
                </div>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-emerald-200 bg-card p-4 shadow-sm">
                  <p className="text-xs text-emerald-600">Confirmées</p>
                  <p className="text-2xl font-semibold text-foreground">{reservationStats.confirmed}</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-card p-4 shadow-sm">
                  <p className="text-xs text-amber-600">En attente</p>
                  <p className="text-2xl font-semibold text-foreground">{reservationStats.pending}</p>
                </div>
                <div className="rounded-2xl border border-red-200 bg-card p-4 shadow-sm">
                  <p className="text-xs text-red-600">Annulées</p>
                  <p className="text-2xl font-semibold text-foreground">{reservationStats.cancelled}</p>
                </div>
                <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <p className="text-xs text-muted-foreground">À qualifier</p>
                  <p className="text-2xl font-semibold text-foreground">{reservationStats.draft}</p>
                </div>
              </div>
              <div className="mt-6 space-y-3">
                {highlightedReservations.length === 0 ? (
                  <p className="text-sm text-slate-400">Aucune réservation synchronisée aujourd'hui.</p>
                ) : (
                  highlightedReservations.map((reservation) => (
                    <div key={reservation.id} className="flex items-center justify-between rounded-2xl border border-border bg-secondary/40 px-4 py-3 text-sm">
                      <div>
                        <p className="font-semibold text-foreground">
                          {reservation.customerFirstName} {reservation.customerLastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {reservation.pickupCity} → {reservation.returnCity}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">#{reservation.id}</span>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section id="reservations-board" className="rounded-[32px] border border-border bg-card p-6 shadow-sm">
              <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Réservations</p>
                  <h2 className="text-2xl font-display font-semibold">Demandes synchronisées</h2>
                  <p className="text-sm text-slate-400">{reservationStats.upcoming} départs à venir</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary/40"
                      >
                        <Filter className="h-4 w-4" />
                        {reservationStatusFilter ? reservationStatusFilter : "Tous les statuts"}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 border-border bg-card text-foreground">
                      <DropdownMenuItem
                        onSelect={() => setReservationStatusFilter(null)}
                        className={`gap-2 ${!reservationStatusFilter ? "bg-secondary/40" : ""}`}
                      >
                        Tous les statuts
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-border" />
                      {["PENDING_PAYMENT", "CONFIRMED", "COMPLETED", "CANCELLED"].map((status) => (
                        <DropdownMenuItem
                          key={status}
                          onSelect={() => setReservationStatusFilter(status)}
                          className={`gap-2 ${reservationStatusFilter === status ? "bg-secondary/40" : ""}`}
                        >
                          {status.split("_").join(" ")}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <button
                    type="button"
                    onClick={openReservationsExportDialog}
                    className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary/40"
                  >
                    <Download className="h-4 w-4" /> Export Excel
                  </button>
                  <button type="button" onClick={fetchReservations} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary/40">
                    <CalendarClock className="h-4 w-4" /> Rafraîchir
                  </button>
                </div>
              </div>

              {reservationsError && (
                <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  {reservationsError}
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="pb-3 font-semibold">Client</th>
                      <th className="pb-3 font-semibold">Véhicule</th>
                      <th className="pb-3 font-semibold">Statut</th>
                      <th className="pb-3 font-semibold">Dates</th>
                      <th className="pb-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservationsLoading ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          Chargement des réservations...
                        </td>
                      </tr>
                    ) : reservations.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-muted-foreground">
                          Aucune réservation n'a encore été enregistrée.
                        </td>
                      </tr>
                    ) : filteredReservations.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-muted-foreground">
                          Aucune réservation ne correspond au filtre sélectionné.
                        </td>
                      </tr>
                    ) : (
                      filteredReservations.map((reservation) => {
                        const relatedCar = cars.find((car) => car.remoteId === reservation.carId);
                        const statusClass = statusStyles[reservation.status] ?? statusStyles.DRAFT;
                        const isProcessing = reservationProcessing === reservation.id;
                        const displayTotal = getDisplayTotalAmount(reservation);

                        return (
                          <tr key={reservation.id} className="border-t border-white/5">
                            <td className="py-3">
                              <p className="font-semibold">
                                {reservation.customerFirstName} {reservation.customerLastName}
                              </p>
                              <p className="text-xs text-slate-400">{reservation.customerEmail}</p>
                              <p className="text-xs text-muted-foreground">{reservation.customerPhone}</p>
                            </td>
                            <td className="py-3 text-foreground">
                              <p className="text-foreground">{relatedCar ? `${relatedCar.brand} ${relatedCar.model}` : `ID ${reservation.carId}`}</p>
                              <p className="text-xs text-muted-foreground">
                                {reservation.pickupCity} → {reservation.returnCity}
                              </p>
                              <a
                                href={buildGoogleMapsSearchUrl(reservation.pickupCity)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                              >
                                <MapPin className="h-3.5 w-3.5" /> Lieu de retrait
                              </a>
                              {reservation.extras.length > 0 && (
                                <p className="text-xs text-muted-foreground">Extras: {reservation.extras.join(", ")}</p>
                              )}
                            </td>
                            <td className="py-3">
                              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>
                                {reservation.status.split("_").join(" ")}
                              </span>
                            </td>
                            <td className="py-3 text-foreground">
                              <p>
                                {reservation.pickupDate} → {reservation.returnDate}
                              </p>
                              <p className="text-xs text-muted-foreground">Total: {formatCurrency(displayTotal)} DH</p>
                            </td>
                            <td className="py-3">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button type="button" className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground hover:bg-secondary/40">
                                    Actions
                                    <EllipsisVertical className="h-4 w-4" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="end"
                                  className="w-48 border-border bg-card text-foreground"
                                >
                                  <DropdownMenuItem
                                    disabled={reservation.status === "CONFIRMED" || reservation.status === "CANCELLED" || isProcessing}
                                    className="gap-2 text-emerald-600 focus:bg-emerald-50 focus:text-emerald-700"
                                    onSelect={() => handleConfirmReservation(reservation.id)}
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Confirmer
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={reservation.status === "CANCELLED" || isProcessing}
                                    className="gap-2 text-amber-600 focus:bg-amber-50 focus:text-amber-700"
                                    onSelect={() => handleCancelReservation(reservation.id)}
                                  >
                                    <XCircle className="h-3.5 w-3.5" /> Annuler
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={isProcessing}
                                    className="gap-2 text-red-600 focus:bg-red-50 focus:text-red-700"
                                    onSelect={() => handleDeleteReservation(reservation)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" /> Supprimer
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator className="bg-slate-200" />
                                  <DropdownMenuItem
                                    className="gap-2 text-foreground focus:bg-secondary/40"
                                    onSelect={() => handleViewReservation(reservation)}
                                  >
                                    <MessageSquare className="h-3.5 w-3.5" /> Détails
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
              </>
            )}

            <Dialog open={exportReservationsOpen} onOpenChange={setExportReservationsOpen}>
              <DialogContent className="border-border bg-card text-foreground sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-display">Exporter les réservations</DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    Choisissez si vous voulez exporter toutes les réservations filtrées ou une période précise.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-border bg-secondary/40 p-4">
                    <p className="mb-3 text-sm font-semibold text-foreground">Période d'export</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setExportPeriodMode("all")}
                        className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                          exportPeriodMode === "all"
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border bg-card text-foreground hover:bg-secondary/40"
                        }`}
                      >
                        <p className="font-semibold">Toutes les données</p>
                        <p className="text-xs text-muted-foreground">Exporte les réservations actuellement filtrées.</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setExportPeriodMode("range")}
                        className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                          exportPeriodMode === "range"
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border bg-card text-foreground hover:bg-secondary/40"
                        }`}
                      >
                        <p className="font-semibold">Sélectionner des dates</p>
                        <p className="text-xs text-muted-foreground">Filtre par date de départ dans l'intervalle choisi.</p>
                      </button>
                    </div>
                  </div>

                  {exportPeriodMode === "range" && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="space-y-2 text-sm text-foreground">
                        Date de début
                        <input
                          type="date"
                          value={exportStartDate}
                          onChange={(event) => setExportStartDate(event.target.value)}
                          className="w-full rounded-2xl border border-border bg-secondary/40 px-4 py-2.5 text-foreground focus:border-primary/40 focus:outline-none"
                        />
                      </label>
                      <label className="space-y-2 text-sm text-foreground">
                        Date de fin
                        <input
                          type="date"
                          value={exportEndDate}
                          onChange={(event) => setExportEndDate(event.target.value)}
                          className="w-full rounded-2xl border border-border bg-secondary/40 px-4 py-2.5 text-foreground focus:border-primary/40 focus:outline-none"
                        />
                      </label>
                    </div>
                  )}


                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => setExportReservationsOpen(false)}
                      className="rounded-2xl border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary/40"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={handleExportReservationsExcel}
                      className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:brightness-110"
                    >
                      Exporter en XLSX
                    </button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {activeSection === "account" && (
              <section className="rounded-[32px] border border-border bg-card p-8 shadow-sm">
                <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Compte & sécurité</p>
                    <h2 className="text-2xl font-display font-semibold">Identifiants administrateur</h2>
                    <p className="text-sm text-slate-400">
                      Mettez à jour vos accès depuis cet espace sécurisé. Les modifications s'appliquent immédiatement.
                    </p>
                  </div>
                  <span className="rounded-full border border-border px-4 py-2 text-xs text-muted-foreground">
                    {adminEmail || "Email non renseigné"}
                  </span>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <form
                    onSubmit={handleEmailSubmit}
                    className="space-y-4 rounded-[28px] border border-border bg-card p-6 shadow-sm"
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground">Mettre à jour l'email</p>
                      <p className="text-xs text-slate-400">Ce courriel servira de login principal.</p>
                    </div>
                    <label className="space-y-1 text-xs text-foreground">
                      Email actuel
                      <input
                        type="email"
                        readOnly
                        className="w-full cursor-not-allowed rounded-2xl border border-border bg-secondary/40 px-4 py-2 text-sm text-muted-foreground"
                        value={emailForm.currentEmail || adminEmail}
                      />
                    </label>
                    <label className="space-y-1 text-xs text-foreground">
                      Nouvel email
                      <input
                        type="email"
                        autoComplete="email"
                        className="w-full rounded-2xl border border-border bg-secondary/40 px-4 py-2 text-sm text-foreground focus:border-blue-300 focus:outline-none"
                        value={emailForm.newEmail}
                        onChange={(event) => setEmailForm((prev) => ({ ...prev, newEmail: event.target.value.trim() }))}
                        required
                      />
                    </label>
                    <label className="space-y-1 text-xs text-foreground">
                      Mot de passe actuel
                      <input
                        type="password"
                        autoComplete="current-password"
                        className="w-full rounded-2xl border border-border bg-secondary/40 px-4 py-2 text-sm text-foreground focus:border-blue-300 focus:outline-none"
                        value={emailForm.password}
                        onChange={(event) => setEmailForm((prev) => ({ ...prev, password: event.target.value }))}
                        required
                      />
                    </label>

                    {emailFeedback && (
                      <p
                        className={`rounded-2xl border px-3 py-2 text-xs ${
                          emailFeedback.tone === "success"
                            ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
                            : emailFeedback.tone === "warning"
                              ? "border-amber-400/40 bg-amber-500/10 text-amber-100"
                              : "border-red-400/40 bg-red-500/10 text-red-200"
                        }`}
                      >
                        {emailFeedback.message}
                      </p>
                    )}

                    <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setEmailForm({ currentEmail: adminEmail, newEmail: "", password: "" });
                          setEmailFeedback(null);
                        }}
                        className="rounded-2xl border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary/40"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        disabled={emailLoading}
                        className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow disabled:opacity-60"
                      >
                        {emailLoading ? "Mise à jour..." : "Changer l'email"}
                      </button>
                    </div>
                  </form>

                  <form
                    onSubmit={handlePasswordSubmit}
                    className="space-y-4 rounded-[28px] border border-border bg-card p-6 shadow-sm"
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground">Changer le mot de passe</p>
                      <p className="text-xs text-slate-400">Choisissez un mot de passe robuste (12 caractères+).</p>
                    </div>
                    <label className="space-y-1 text-xs text-foreground">
                      Mot de passe actuel
                      <input
                        type="password"
                        autoComplete="current-password"
                        className="w-full rounded-2xl border border-border bg-secondary/40 px-4 py-2 text-sm text-foreground focus:border-blue-300 focus:outline-none"
                        value={passwordForm.currentPassword}
                        onChange={(event) =>
                          setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))
                        }
                        required
                      />
                    </label>
                    <label className="space-y-1 text-xs text-foreground">
                      Nouveau mot de passe
                      <input
                        type="password"
                        autoComplete="new-password"
                        className="w-full rounded-2xl border border-border bg-secondary/40 px-4 py-2 text-sm text-foreground focus:border-blue-300 focus:outline-none"
                        value={passwordForm.newPassword}
                        onChange={(event) => setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))}
                        required
                        minLength={8}
                      />
                    </label>
                    <label className="space-y-1 text-xs text-foreground">
                      Confirmation
                      <input
                        type="password"
                        autoComplete="new-password"
                        className="w-full rounded-2xl border border-border bg-secondary/40 px-4 py-2 text-sm text-foreground focus:border-blue-300 focus:outline-none"
                        value={passwordForm.confirmPassword}
                        onChange={(event) =>
                          setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
                        }
                        required
                      />
                    </label>

                    {passwordFeedback && (
                      <p
                        className={`rounded-2xl border px-3 py-2 text-xs ${
                          passwordFeedback.tone === "success"
                            ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
                            : "border-red-400/40 bg-red-500/10 text-red-200"
                        }`}
                      >
                        {passwordFeedback.message}
                      </p>
                    )}

                    <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
                          setPasswordFeedback(null);
                        }}
                        className="rounded-2xl border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary/40"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        disabled={passwordLoading}
                        className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow disabled:opacity-60"
                      >
                        {passwordLoading ? "Enregistrement..." : "Mettre à jour"}
                      </button>
                    </div>
                  </form>
                </div>
              </section>
            )}
          </section>
        </div>

        <Sheet open={navDrawerOpen} onOpenChange={setNavDrawerOpen}>
          <SheetContent
            side="left"
            className="w-full max-w-sm border-white/10 bg-slate-950 text-white sm:max-w-xs"
          >
            <SheetHeader>
              <SheetTitle>Navigation</SheetTitle>
              <SheetDescription>Choisissez une section pour y accéder rapidement.</SheetDescription>
            </SheetHeader>
            <div className="mt-4 space-y-3">
              {dashboardNav.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    switchSection(item.key);
                    setNavDrawerOpen(false);
                  }}
                  className={`w-full rounded-2xl px-4 py-3 text-left text-base font-semibold transition ${
                    activeSection === item.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-card/5 text-slate-200 hover:bg-card/10"
                  }`}
                >
                  <p>{item.label}</p>
                  <p className="text-xs font-normal text-white/70">{item.description}</p>
                </button>
              ))}
            </div>
          </SheetContent>
        </Sheet>

        <Dialog open={quickReservationOpen} onOpenChange={setQuickReservationOpen}>
          <DialogContent className="border-white/10 bg-slate-900 text-white sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-2xl font-display">
                <CalendarPlus className="h-5 w-5 text-cyan-300" />
                Ajouter une réservation
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                Créez une réservation en un seul formulaire sans quitter le dashboard.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleQuickReservationSubmit} className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1 text-xs text-slate-300">
                  Véhicule
                  <select
                    required
                    value={quickReservationForm.carId}
                    onChange={(event) =>
                      setQuickReservationForm((previous) => ({ ...previous, carId: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
                  >
                    <option value="">Sélectionner</option>
                    {cars
                      .filter((car) => car.remoteId != null)
                      .map((car) => (
                        <option key={car.id} value={String(car.remoteId)}>
                          {car.brand} {car.model}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs text-slate-300">
                  Document ID
                  <input
                    required
                    value={quickReservationForm.documentId}
                    onChange={(event) =>
                      setQuickReservationForm((previous) => ({ ...previous, documentId: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1 text-xs text-slate-300">
                  Prénom
                  <input
                    required
                    value={quickReservationForm.firstName}
                    onChange={(event) =>
                      setQuickReservationForm((previous) => ({ ...previous, firstName: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
                  />
                </label>
                <label className="space-y-1 text-xs text-slate-300">
                  Nom
                  <input
                    required
                    value={quickReservationForm.lastName}
                    onChange={(event) =>
                      setQuickReservationForm((previous) => ({ ...previous, lastName: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1 text-xs text-slate-300">
                  Email
                  <input
                    type="email"
                    required
                    value={quickReservationForm.email}
                    onChange={(event) =>
                      setQuickReservationForm((previous) => ({ ...previous, email: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
                  />
                </label>
                <label className="space-y-1 text-xs text-slate-300">
                  Téléphone
                  <input
                    required
                    value={quickReservationForm.phone}
                    onChange={(event) =>
                      setQuickReservationForm((previous) => ({ ...previous, phone: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1 text-xs text-slate-300">
                  Ville départ
                  <input
                    required
                    value={quickReservationForm.pickupCity}
                    onChange={(event) =>
                      setQuickReservationForm((previous) => ({ ...previous, pickupCity: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
                  />
                </label>
                <label className="space-y-1 text-xs text-slate-300">
                  Ville retour
                  <input
                    required
                    value={quickReservationForm.returnCity}
                    onChange={(event) =>
                      setQuickReservationForm((previous) => ({ ...previous, returnCity: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1 text-xs text-slate-300">
                  Date départ
                  <input
                    type="date"
                    min={todayIso}
                    required
                    value={quickReservationForm.pickupDate}
                    onChange={(event) =>
                      setQuickReservationForm((previous) => ({ ...previous, pickupDate: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
                  />
                </label>
                <label className="space-y-1 text-xs text-slate-300">
                  Date retour
                  <input
                    type="date"
                    min={quickReservationForm.pickupDate || todayIso}
                    required
                    value={quickReservationForm.returnDate}
                    onChange={(event) =>
                      setQuickReservationForm((previous) => ({ ...previous, returnDate: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <label className="space-y-1 text-xs text-slate-300">
                Notes
                <textarea
                  value={quickReservationForm.notes}
                  onChange={(event) =>
                    setQuickReservationForm((previous) => ({ ...previous, notes: event.target.value }))
                  }
                  className="h-20 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
                />
              </label>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setQuickReservationOpen(false)}
                  className="rounded-2xl border border-white/20 px-4 py-2 text-sm hover:bg-card/5"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={quickReservationLoading}
                  className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {quickReservationLoading ? "Création..." : "Créer la réservation"}
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={quickVehicleOpen} onOpenChange={setQuickVehicleOpen}>
          <DialogContent className="border-white/10 bg-slate-900 text-white sm:max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-2xl font-display">
                <PlusCircle className="h-5 w-5 text-cyan-300" />
                Ajouter un véhicule
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                Création rapide d'un véhicule dans la flotte connectée.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleQuickVehicleSubmit} className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1 text-xs text-slate-300">
                  Marque
                  <input
                    required
                    value={quickCarForm.brand}
                    onChange={(event) => setQuickCarForm((previous) => ({ ...previous, brand: event.target.value }))}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
                  />
                </label>
                <label className="space-y-1 text-xs text-slate-300">
                  Modèle
                  <input
                    required
                    value={quickCarForm.model}
                    onChange={(event) => setQuickCarForm((previous) => ({ ...previous, model: event.target.value }))}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1 text-xs text-slate-300">
                  Catégorie
                  <input
                    required
                    value={quickCarForm.category}
                    onChange={(event) => setQuickCarForm((previous) => ({ ...previous, category: event.target.value }))}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
                  />
                </label>
                <label className="space-y-1 text-xs text-slate-300">
                  Prix / jour (DH)
                  <input
                    type="number"
                    min="0"
                    required
                    value={quickCarForm.pricePerDay}
                    onChange={(event) =>
                      setQuickCarForm((previous) => ({ ...previous, pricePerDay: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="space-y-1 text-xs text-slate-300">
                  Transmission
                  <select
                    value={quickCarForm.transmission}
                    onChange={(event) =>
                      setQuickCarForm((previous) => ({ ...previous, transmission: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
                  >
                    <option value="Automatique">Automatique</option>
                    <option value="Manuelle">Manuelle</option>
                  </select>
                </label>
                <label className="space-y-1 text-xs text-slate-300">
                  Carburant
                  <select
                    value={quickCarForm.fuel}
                    onChange={(event) => setQuickCarForm((previous) => ({ ...previous, fuel: event.target.value }))}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
                  >
                    <option value="Diesel">Diesel</option>
                    <option value="Essence">Essence</option>
                    <option value="Hybride">Hybride</option>
                    <option value="Électrique">Électrique</option>
                  </select>
                </label>
                <label className="space-y-1 text-xs text-slate-300">
                  Places
                  <input
                    type="number"
                    min="2"
                    required
                    value={quickCarForm.seats}
                    onChange={(event) => setQuickCarForm((previous) => ({ ...previous, seats: event.target.value }))}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <label className="space-y-1 text-xs text-slate-300">
                Image (URL)
                <input
                  type="url"
                  required
                  value={quickCarForm.image}
                  onChange={(event) => setQuickCarForm((previous) => ({ ...previous, image: event.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
                />
              </label>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setQuickVehicleOpen(false)}
                  className="rounded-2xl border border-white/20 px-4 py-2 text-sm hover:bg-card/5"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={quickVehicleLoading}
                  className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {quickVehicleLoading ? "Création..." : "Créer le véhicule"}
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={quickCustomerOpen} onOpenChange={setQuickCustomerOpen}>
          <DialogContent className="border-white/10 bg-slate-900 text-white sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-2xl font-display">
                <UserPlus className="h-5 w-5 text-cyan-300" />
                Ajouter un client
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                Ouvrez le flow de réservation pré-rempli pour finaliser l'inscription client.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleQuickCustomerRoute} className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1 text-xs text-slate-300">
                  Prénom
                  <input
                    required
                    value={quickCustomerForm.firstName}
                    onChange={(event) =>
                      setQuickCustomerForm((previous) => ({ ...previous, firstName: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
                  />
                </label>
                <label className="space-y-1 text-xs text-slate-300">
                  Nom
                  <input
                    required
                    value={quickCustomerForm.lastName}
                    onChange={(event) =>
                      setQuickCustomerForm((previous) => ({ ...previous, lastName: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <label className="space-y-1 text-xs text-slate-300">
                Email
                <input
                  required
                  type="email"
                  value={quickCustomerForm.email}
                  onChange={(event) => setQuickCustomerForm((previous) => ({ ...previous, email: event.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-1 text-xs text-slate-300">
                Téléphone
                <input
                  required
                  value={quickCustomerForm.phone}
                  onChange={(event) => setQuickCustomerForm((previous) => ({ ...previous, phone: event.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
                />
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setQuickCustomerOpen(false)}
                  className="rounded-2xl border border-white/20 px-4 py-2 text-sm hover:bg-card/5"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  Continuer vers réservation
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={confirmDialog != null} onOpenChange={(open) => (!open ? closeConfirmDialog() : null)}>
          <DialogContent className="border-white/10 bg-slate-900 text-white">
            <DialogHeader>
              <DialogTitle className="text-2xl font-display">
                {confirmDialogCopy?.title ?? "Confirmer l'action"}
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                {confirmDialogCopy?.description ?? "Confirmez pour appliquer cette opération."}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="rounded-2xl border border-white/20 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-card/5 disabled:opacity-50"
                onClick={closeConfirmDialog}
                disabled={confirmingAction}
              >
                Annuler
              </button>
              <button
                type="button"
                className={`rounded-2xl px-4 py-2 text-sm font-semibold shadow disabled:opacity-60 ${
                  confirmDialogCopy?.tone === "destructive"
                    ? "bg-red-500 text-white hover:bg-red-400"
                    : "bg-primary text-primary-foreground hover:brightness-110"
                }`}
                onClick={executeConfirmDialog}
                disabled={confirmingAction}
              >
                {confirmingAction ? "Traitement..." : confirmDialogCopy?.confirmLabel ?? "Confirmer"}
              </button>
            </div>
          </DialogContent>
        </Dialog>
        {selectedReservation && (
          <Dialog
            open={detailsOpen}
            onOpenChange={(open) => {
              setDetailsOpen(open);
              if (!open) {
                setSelectedReservation(null);
              }
            }}
          >
            <DialogContent className="border-white/10 bg-slate-900 text-white">
              <DialogHeader>
                <DialogTitle className="text-2xl font-display">
                  Détails de la réservation #{selectedReservation.id}
                </DialogTitle>
                <DialogDescription className="text-slate-400">
                  {selectedReservation.customerFirstName} {selectedReservation.customerLastName} • {selectedReservation.customerEmail}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="rounded-2xl border border-white/10 p-4">
                  <p className="mb-1 text-xs uppercase tracking-[0.4em] text-muted-foreground">Client</p>
                  <p className="font-semibold">
                    {selectedReservation.customerFirstName} {selectedReservation.customerLastName}
                  </p>
                  <p className="text-slate-300">{selectedReservation.customerPhone}</p>
                </div>
                <div className="rounded-2xl border border-white/10 p-4">
                  <p className="mb-1 text-xs uppercase tracking-[0.4em] text-muted-foreground">Trajet</p>
                  <p className="font-semibold">
                    {selectedReservation.pickupCity} → {selectedReservation.returnCity}
                  </p>
                  <p className="text-slate-300">
                    {selectedReservation.pickupDate} au {selectedReservation.returnDate}
                  </p>
                  <a
                    href={buildGoogleMapsSearchUrl(selectedReservation.pickupCity)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <MapPin className="h-3.5 w-3.5" /> Ouvrir le retrait dans Google Maps
                  </a>
                </div>
                <div className="rounded-2xl border border-white/10 p-4">
                  <p className="mb-1 text-xs uppercase tracking-[0.4em] text-muted-foreground">Véhicule</p>
                  <p>
                    {(() => {
                      const car = cars.find((c) => c.remoteId === selectedReservation.carId);
                      return car ? `${car.brand} ${car.model}` : `ID ${selectedReservation.carId}`;
                    })()}
                  </p>
                  <p className="text-slate-300">Statut: {selectedReservation.status.split("_").join(" ")}</p>
                </div>
                <div className="rounded-2xl border border-white/10 p-4">
                  <p className="mb-1 text-xs uppercase tracking-[0.4em] text-muted-foreground">Extras</p>
                  {selectedReservation.extras.length === 0 ? (
                    <p className="text-slate-400">Aucun extra sélectionné.</p>
                  ) : (
                    <ul className="list-disc pl-5 text-slate-200">
                      {selectedReservation.extras.map((extra) => (
                        <li key={extra}>{extra}</li>
                      ))}
                    </ul>
                  )}
                </div>
                {selectedReservation.notes && (
                  <div className="rounded-2xl border border-white/10 p-4">
                    <p className="mb-1 text-xs uppercase tracking-[0.4em] text-muted-foreground">Notes / Itinéraire</p>
                    <p className="whitespace-pre-line text-slate-200">{selectedReservation.notes}</p>
                  </div>
                )}
                <div className="flex items-center justify-between rounded-2xl border border-white/10 p-4">
                  <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Total estimé</p>
                  <p className="text-2xl font-bold">{formatCurrency(getDisplayTotalAmount(selectedReservation))} DH</p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;



