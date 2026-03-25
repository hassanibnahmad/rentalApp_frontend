import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  EllipsisVertical,
  LogOut,
  Menu,
  MessageSquare,
  PlusCircle,
  RefreshCcw,
  Trash2,
  Wand2,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { useCarInventory } from "@/contexts/CarInventoryContext";
import { defaultHighlights, type CarDetail } from "@/data/cars";
import { apiClient } from "@/lib/api-client";
import { resolveFriendlyError } from "@/lib/errors";
import { useToast } from "@/components/ui/use-toast";
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
  DRAFT: "bg-slate-500/10 text-slate-200",
  CANCELLED: "bg-red-500/10 text-red-200",
  COMPLETED: "bg-blue-500/10 text-blue-200",
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
  const handleDashboardLogout = useCallback(() => {
    logout();
    navigate("/");
  }, [logout, navigate]);

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
  const reservationOverview = useMemo(
    () => [
      {
        key: "total",
        label: "Demandes suivies",
        helper: "Toutes les demandes actives",
        value: reservations.length,
        cardClass: "border-white/10 bg-white/5",
        valueClass: "text-white",
      },
      {
        key: "confirmed",
        label: "Confirmées",
        helper: "Prêtes à être livrées",
        value: reservationStats.confirmed,
        cardClass: "border-emerald-400/40 bg-emerald-500/10",
        valueClass: "text-emerald-100",
      },
      {
        key: "pending",
        label: "En attente",
        helper: "Demandes à valider",
        value: reservationStats.pending,
        cardClass: "border-amber-400/40 bg-amber-500/10",
        valueClass: "text-amber-100",
      },
      {
        key: "cancelled",
        label: "Annulées",
        helper: "Dernières annulations",
        value: reservationStats.cancelled,
        cardClass: "border-red-400/40 bg-red-500/10",
        valueClass: "text-red-100",
      },
      {
        key: "draft",
        label: "À qualifier",
        helper: "Demandes à clarifier",
        value: reservationStats.draft,
        cardClass: "border-slate-400/30 bg-slate-500/10",
        valueClass: "text-slate-100",
      },
      {
        key: "upcoming",
        label: "Départs à venir",
        helper: "Trajets programmés",
        value: reservationStats.upcoming,
        cardClass: "border-cyan-400/30 bg-cyan-500/10",
        valueClass: "text-cyan-100",
      },
    ],
    [reservationStats, reservations.length],
  );

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

  useEffect(() => {
    if (adminEmail) {
      setEmailForm((previous) => ({ ...previous, currentEmail: adminEmail }));
    }
  }, [adminEmail]);

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
    if (!formState.brand || !formState.model || !formState.image) {
      return;
    }

    setPendingAction(true);
    try {
      if (editingSlug) {
        if (editingRemoteId == null) {
          alert("Cette voiture n'est pas encore reliée au serveur central.");
          return;
        }
        const existingCar = cars.find((car) => car.remoteId === editingRemoteId);
        if (!existingCar) {
          alert("Voiture introuvable.");
          return;
        }
        const payload = buildCarRecord(formState, existingCar);
        await updateCar(editingRemoteId, payload);
      } else {
        const payload = buildCarRecord(formState);
        await addCar(payload);
      }

      clearForm();
    } catch (actionError) {
      console.error("Impossible d'enregistrer la voiture", actionError);
      alert("Erreur lors de l'enregistrement. Vérifiez la console pour plus de détails.");
    } finally {
      setPendingAction(false);
    }
  };

  const handleEdit = (car: CarDetail) => {
    if (car.remoteId == null) {
      alert(
        "Cette voiture provient des données locales et ne peut pas être modifiée tant que la synchronisation avec le serveur n'est pas terminée.",
      );
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
      alert("Cette voiture n'est pas synchronisée avec le serveur central.");
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

  const deleteCarRecord = async (car: CarDetail) => {
    if (car.remoteId == null) {
      alert("Cette voiture n'est pas synchronisée avec le serveur central.");
      throw new Error("Unsynced car");
    }
    try {
      await deleteCar(car.remoteId);
    } catch (deleteError) {
      console.error("Suppression impossible", deleteError);
      alert("Erreur lors de la suppression.");
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
    } catch (resetError) {
      console.error("Erreur lors de la restauration", resetError);
      alert("Impossible de restaurer la flotte.");
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
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl space-y-8 px-4 pb-20 pt-28">
        <section className="rounded-[40px] border border-white/10 bg-gradient-to-br from-[#0b1120] via-[#050714] to-[#010309] p-8 shadow-[0_35px_120px_rgba(3,7,18,0.65)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Vue générale</p>
              <h1 className="text-3xl font-display font-bold md:text-4xl">Centre de commandes</h1>
              <p className="mt-2 max-w-xl text-sm text-slate-300">
                Gardez un œil en un coup d'œil sur la flotte et les demandes reçues sans changer de section.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={fetchReservations}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:border-primary hover:bg-primary/10"
              >
                <RefreshCcw className="h-4 w-4" /> Actualiser
              </button>
              <button
                type="button"
                onClick={() => setNavDrawerOpen(true)}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 lg:hidden"
              >
                <Menu className="h-4 w-4" /> Menu
              </button>
              <button
                type="button"
                onClick={handleDashboardLogout}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
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
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="mb-2 text-xs uppercase tracking-[0.4em] text-slate-400">Véhicules actifs</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold">{stats.total}</span>
                <span className="text-sm text-slate-400">catalogue connecté</span>
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-600/20 via-purple-600/10 to-transparent p-5">
              <p className="mb-2 text-xs uppercase tracking-[0.4em] text-slate-300">Panier moyen</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold">{formatCurrency(stats.avgPrice)} DH</span>
                <span className="text-sm text-slate-300">/ jour</span>
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="mb-2 text-xs uppercase tracking-[0.4em] text-slate-400">Automatique</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold">{stats.automaticShare}%</span>
                <span className="text-sm text-slate-400">de la flotte</span>
              </div>
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {reservationOverview.map((metric) => (
              <div
                key={metric.key}
                className={`rounded-3xl border p-5 ${metric.cardClass}`}
              >
                <p className="mb-2 text-xs uppercase tracking-[0.4em] text-white/80">{metric.label}</p>
                <p className={`text-3xl font-bold ${metric.valueClass}`}>{metric.value}</p>
                <p className="text-xs text-white/70">{metric.helper}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[260px,1fr] lg:items-start lg:gap-10">
          <aside className="hidden w-64 shrink-0 flex-col rounded-[32px] border border-white/10 bg-[#060b18] px-5 py-6 lg:sticky lg:top-24 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto lg:flex">
            <div className="border-b border-white/5 pb-5">
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Julia Auto Cars</p>
              <p className="text-lg font-display font-semibold text-white">Espace admin</p>
              <p className="text-xs text-slate-400">Pilotage temps réel</p>
            </div>
            <nav className="mt-6 flex flex-1 flex-col gap-2">
              {dashboardNav.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveSection(item.key)}
                  className={`rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                    activeSection === item.key
                      ? "border border-white/20 bg-white/10 text-white shadow-[0_10px_30px_rgba(15,23,42,0.45)]"
                      : "border border-white/5 bg-transparent text-slate-300 hover:border-white/20 hover:bg-white/5"
                  }`}
                >
                  <p>{item.label}</p>
                  <p className="text-xs font-normal text-slate-400">{item.description}</p>
                </button>
              ))}
            </nav>
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-slate-300">
              <p className="text-white">Dernière synchronisation</p>
              <p className="text-sm font-semibold text-white">{syncLabel}</p>
              <p className="text-slate-400">Flux flotte & réservations</p>
            </div>
          </aside>

          <section className="flex-1 space-y-10">
            {activeSection === "cars" && (
              <>
                <section className="grid gap-6 lg:grid-cols-[0.85fr,1.15fr]">
              <div className="space-y-6">
                <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-6">
                  <div className="mb-4">
                    <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Centre opérationnel</p>
                    <h2 className="text-2xl font-display font-semibold">Actions rapides</h2>
                  </div>
                  <div className="grid gap-3">
                    <button
                      type="button"
                      onClick={prefillLuxuryTemplate}
                      className="inline-flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:border-primary"
                    >
                      Pré-remplir une fiche Business
                      <PlusCircle className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={clearForm}
                      className="inline-flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-200 hover:border-primary"
                    >
                      Nettoyer le formulaire
                      <Wand2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-6">
                  <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Fiches actives</p>
                      <h2 className="text-2xl font-display font-semibold">Dernières voitures</h2>
                    </div>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
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
                          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-slate-100 transition hover:border-primary"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold">{car.brand} {car.model}</p>
                              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{car.slug}</p>
                            </div>
                            <p className="text-xs text-slate-300">{car.pricePerDay} DH/j</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <form
                onSubmit={handleSubmit}
                className="rounded-[32px] border border-white/10 bg-gradient-to-b from-slate-900 via-slate-900/70 to-slate-950 p-8 shadow-[0_25px_80px_rgba(2,6,23,0.65)]"
              >
                <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-slate-400">
                      {editingSlug ? "Edition" : "Nouveau"}
                    </p>
                    <h2 className="text-2xl font-display font-semibold">
                      {editingSlug ? "Mettre à jour" : "Enregistrer"} une voiture
                    </h2>
                  </div>
                  {editingSlug && (
                    <button
                      type="button"
                      className="text-sm text-slate-300 underline"
                      onClick={clearForm}
                    >
                      Annuler l'édition
                    </button>
                  )}
                </div>

                <div className="grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-2 text-sm text-slate-300">
                      Marque
                      <input
                        className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-2.5 focus:border-primary focus:outline-none"
                        value={formState.brand}
                        onChange={(event) => setFormState((prev) => ({ ...prev, brand: event.target.value }))}
                        required
                      />
                    </label>
                    <label className="space-y-2 text-sm text-slate-300">
                      Modèle
                      <input
                        className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-2.5 focus:border-primary focus:outline-none"
                        value={formState.model}
                        onChange={(event) => setFormState((prev) => ({ ...prev, model: event.target.value }))}
                        required
                      />
                    </label>
                  </div>

                  <label className="space-y-2 text-sm text-slate-300">
                    Catégorie
                    <input
                      className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-2.5 focus:border-primary focus:outline-none"
                      value={formState.category}
                      onChange={(event) => setFormState((prev) => ({ ...prev, category: event.target.value }))}
                    />
                  </label>

                  <label className="space-y-2 text-sm text-slate-300">
                    Description courte
                    <textarea
                      className="h-28 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-2.5 focus:border-primary focus:outline-none"
                      value={formState.description}
                      onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
                    />
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-2 text-sm text-slate-300">
                      Prix journalier (DH)
                      <input
                        type="number"
                        min="0"
                        className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-2.5 focus:border-primary focus:outline-none"
                        value={formState.pricePerDay}
                        onChange={(event) => setFormState((prev) => ({ ...prev, pricePerDay: event.target.value }))}
                        required
                      />
                    </label>
                    <label className="space-y-2 text-sm text-slate-300">
                      Image (URL)
                      <input
                        type="url"
                        className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-2.5 focus:border-primary focus:outline-none"
                        value={formState.image}
                        onChange={(event) => setFormState((prev) => ({ ...prev, image: event.target.value }))}
                        required
                      />
                    </label>
                  </div>

                  <p className="text-xs text-slate-500">
                    Ajoutez jusqu'à 3 images. Les visuels supplémentaires sont optionnels.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-2 text-sm text-slate-300">
                      Image secondaire (URL)
                      <input
                        type="url"
                        placeholder="Optionnel"
                        className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-2.5 focus:border-primary focus:outline-none"
                        value={formState.imageSecondary}
                        onChange={(event) =>
                          setFormState((prev) => ({ ...prev, imageSecondary: event.target.value }))
                        }
                      />
                    </label>
                    <label className="space-y-2 text-sm text-slate-300">
                      Image 3 (URL)
                      <input
                        type="url"
                        placeholder="Optionnel"
                        className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-2.5 focus:border-primary focus:outline-none"
                        value={formState.imageThird}
                        onChange={(event) =>
                          setFormState((prev) => ({ ...prev, imageThird: event.target.value }))
                        }
                      />
                    </label>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <label className="space-y-2 text-sm text-slate-300">
                      Transmission
                      <select
                        className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-2.5 focus:border-primary focus:outline-none"
                        value={formState.transmission}
                        onChange={(event) => setFormState((prev) => ({ ...prev, transmission: event.target.value }))}
                      >
                        <option value="Automatique">Automatique</option>
                        <option value="Manuelle">Manuelle</option>
                      </select>
                    </label>
                    <label className="space-y-2 text-sm text-slate-300">
                      Carburant
                      <select
                        className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-2.5 focus:border-primary focus:outline-none"
                        value={formState.fuel}
                        onChange={(event) => setFormState((prev) => ({ ...prev, fuel: event.target.value }))}
                      >
                        <option value="Diesel">Diesel</option>
                        <option value="Essence">Essence</option>
                        <option value="Hybride">Hybride</option>
                        <option value="Électrique">Électrique</option>
                      </select>
                    </label>
                    <label className="space-y-2 text-sm text-slate-300">
                      Places
                      <input
                        type="number"
                        min="2"
                        className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-2.5 focus:border-primary focus:outline-none"
                        value={formState.seats}
                        onChange={(event) => setFormState((prev) => ({ ...prev, seats: event.target.value }))}
                      />
                    </label>
                  </div>

                  <label className="space-y-2 text-sm text-slate-300">
                    Message WhatsApp personnalisé
                    <input
                      className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-2.5 focus:border-primary focus:outline-none"
                      value={formState.whatsappMessage}
                      onChange={(event) => setFormState((prev) => ({ ...prev, whatsappMessage: event.target.value }))}
                    />
                  </label>

                  <label className="space-y-2 text-sm text-slate-300">
                    Équipements (un par ligne)
                    <textarea
                      className="h-32 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-2.5 focus:border-primary focus:outline-none"
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

            <section id="cars-board" className="rounded-[32px] border border-white/10 bg-slate-900/70 p-6">
              <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Inventaire</p>
                  <h2 className="text-2xl font-display font-semibold">Voitures connectées</h2>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                    {filteredCars.length} résultats / {cars.length}
                  </span>
                  <input
                    placeholder="Rechercher un modèle"
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-2 text-sm focus:border-primary focus:outline-none sm:w-64"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-slate-400">
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
                        <td colSpan={5} className="py-8 text-center text-slate-500">
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
                                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{car.slug}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 text-slate-300">{car.category}</td>
                          <td className="py-3 text-slate-300">{car.pricePerDay} DH</td>
                          <td className="py-3 text-slate-300">{car.transmission}</td>
                          <td className="py-3">
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                disabled={car.remoteId == null}
                                className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200 hover:border-primary disabled:opacity-50"
                                title={car.remoteId ? undefined : "Synchronisation requise"}
                                onClick={() => handleEdit(car)}
                              >
                                <Wand2 className="h-3 w-3" /> Modifier
                              </button>
                              <button
                                type="button"
                                disabled={car.remoteId == null}
                                className="inline-flex items-center gap-1 rounded-full border border-red-400/40 px-3 py-1 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-50"
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
                <section id="reservations-analytics" className="rounded-[32px] border border-white/10 bg-slate-900/80 p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Réservations</p>
                  <h2 className="text-2xl font-display font-semibold">Pipeline en direct</h2>
                  <p className="text-sm text-slate-400">Synchronisées automatiquement depuis les demandes en ligne</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                    {reservations.length} demandes
                  </span>
                  <button
                    type="button"
                    onClick={fetchReservations}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
                  >
                    <RefreshCcw className="h-4 w-4" /> Rafraîchir
                  </button>
                </div>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
                  <p className="text-xs text-emerald-200">Confirmées</p>
                  <p className="text-2xl font-semibold">{reservationStats.confirmed}</p>
                </div>
                <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4">
                  <p className="text-xs text-amber-200">En attente</p>
                  <p className="text-2xl font-semibold">{reservationStats.pending}</p>
                </div>
                <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4">
                  <p className="text-xs text-red-200">Annulées</p>
                  <p className="text-2xl font-semibold">{reservationStats.cancelled}</p>
                </div>
                <div className="rounded-2xl border border-slate-400/30 bg-slate-500/10 p-4">
                  <p className="text-xs text-slate-200">À qualifier</p>
                  <p className="text-2xl font-semibold">{reservationStats.draft}</p>
                </div>
              </div>
              <div className="mt-6 space-y-3">
                {highlightedReservations.length === 0 ? (
                  <p className="text-sm text-slate-400">Aucune réservation synchronisée aujourd'hui.</p>
                ) : (
                  highlightedReservations.map((reservation) => (
                    <div
                      key={reservation.id}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
                    >
                      <div>
                        <p className="font-semibold">
                          {reservation.customerFirstName} {reservation.customerLastName}
                        </p>
                        <p className="text-xs text-slate-400">
                          {reservation.pickupCity} → {reservation.returnCity}
                        </p>
                      </div>
                      <span className="text-xs text-slate-400">#{reservation.id}</span>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section id="reservations-board" className="rounded-[32px] border border-white/10 bg-slate-900/70 p-6">
              <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Réservations</p>
                  <h2 className="text-2xl font-display font-semibold">Demandes synchronisées</h2>
                  <p className="text-sm text-slate-400">{reservationStats.upcoming} départs à venir</p>
                </div>
                <button
                  type="button"
                  onClick={fetchReservations}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
                >
                  <CalendarClock className="h-4 w-4" /> Rafraîchir
                </button>
              </div>

              {reservationsError && (
                <div className="mb-4 rounded-2xl border border-yellow-400/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
                  {reservationsError}
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-slate-400">
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
                        <td colSpan={5} className="py-8 text-center text-slate-500">
                          Aucune réservation n'a encore été enregistrée.
                        </td>
                      </tr>
                    ) : (
                      reservations.map((reservation) => {
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
                              <p className="text-xs text-slate-500">{reservation.customerPhone}</p>
                            </td>
                            <td className="py-3 text-slate-300">
                              <p>{relatedCar ? `${relatedCar.brand} ${relatedCar.model}` : `ID ${reservation.carId}`}</p>
                              <p className="text-xs text-slate-500">
                                {reservation.pickupCity} → {reservation.returnCity}
                              </p>
                              {reservation.extras.length > 0 && (
                                <p className="text-xs text-slate-400">Extras: {reservation.extras.join(", ")}</p>
                              )}
                            </td>
                            <td className="py-3">
                              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>
                                {reservation.status.split("_").join(" ")}
                              </span>
                            </td>
                            <td className="py-3 text-slate-300">
                              <p>
                                {reservation.pickupDate} → {reservation.returnDate}
                              </p>
                              <p className="text-xs text-slate-400">Total: {formatCurrency(displayTotal)} DH</p>
                            </td>
                            <td className="py-3">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-slate-100 hover:bg-white/10"
                                  >
                                    Actions
                                    <EllipsisVertical className="h-4 w-4" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="end"
                                  className="w-48 border-white/10 bg-slate-900/95 text-slate-100"
                                >
                                  <DropdownMenuItem
                                    disabled={reservation.status === "CONFIRMED" || reservation.status === "CANCELLED" || isProcessing}
                                    className="gap-2 text-emerald-200 focus:bg-emerald-500/10 focus:text-emerald-100"
                                    onSelect={() => handleConfirmReservation(reservation.id)}
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Confirmer
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={reservation.status === "CANCELLED" || isProcessing}
                                    className="gap-2 text-amber-200 focus:bg-amber-500/10 focus:text-amber-100"
                                    onSelect={() => handleCancelReservation(reservation.id)}
                                  >
                                    <XCircle className="h-3.5 w-3.5" /> Annuler
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={isProcessing}
                                    className="gap-2 text-red-200 focus:bg-red-500/10 focus:text-red-100"
                                    onSelect={() => handleDeleteReservation(reservation)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" /> Supprimer
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator className="bg-white/10" />
                                  <DropdownMenuItem
                                    className="gap-2 text-slate-100 focus:bg-white/10"
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

            {activeSection === "account" && (
              <section className="rounded-[32px] border border-white/10 bg-slate-900/70 p-8 shadow-[0_25px_80px_rgba(2,6,23,0.45)]">
                <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Compte & sécurité</p>
                    <h2 className="text-2xl font-display font-semibold">Identifiants administrateur</h2>
                    <p className="text-sm text-slate-400">
                      Mettez à jour vos accès depuis cet espace sécurisé. Les modifications s'appliquent immédiatement.
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 px-4 py-2 text-xs text-slate-300">
                    {adminEmail || "Email non renseigné"}
                  </span>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <form
                    onSubmit={handleEmailSubmit}
                    className="space-y-4 rounded-[28px] border border-white/10 bg-white/5 p-6"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">Mettre à jour l'email</p>
                      <p className="text-xs text-slate-400">Ce courriel servira de login principal.</p>
                    </div>
                    <label className="space-y-1 text-xs text-slate-300">
                      Email actuel
                      <input
                        type="email"
                        readOnly
                        className="w-full cursor-not-allowed rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-2 text-sm text-slate-400"
                        value={emailForm.currentEmail || adminEmail}
                      />
                    </label>
                    <label className="space-y-1 text-xs text-slate-300">
                      Nouvel email
                      <input
                        type="email"
                        autoComplete="email"
                        className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-2 text-sm focus:border-primary focus:outline-none"
                        value={emailForm.newEmail}
                        onChange={(event) => setEmailForm((prev) => ({ ...prev, newEmail: event.target.value.trim() }))}
                        required
                      />
                    </label>
                    <label className="space-y-1 text-xs text-slate-300">
                      Mot de passe actuel
                      <input
                        type="password"
                        autoComplete="current-password"
                        className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-2 text-sm focus:border-primary focus:outline-none"
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
                        className="rounded-2xl border border-white/20 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
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
                    className="space-y-4 rounded-[28px] border border-white/10 bg-white/5 p-6"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">Changer le mot de passe</p>
                      <p className="text-xs text-slate-400">Choisissez un mot de passe robuste (12 caractères+).</p>
                    </div>
                    <label className="space-y-1 text-xs text-slate-300">
                      Mot de passe actuel
                      <input
                        type="password"
                        autoComplete="current-password"
                        className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-2 text-sm focus:border-primary focus:outline-none"
                        value={passwordForm.currentPassword}
                        onChange={(event) =>
                          setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))
                        }
                        required
                      />
                    </label>
                    <label className="space-y-1 text-xs text-slate-300">
                      Nouveau mot de passe
                      <input
                        type="password"
                        autoComplete="new-password"
                        className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-2 text-sm focus:border-primary focus:outline-none"
                        value={passwordForm.newPassword}
                        onChange={(event) => setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))}
                        required
                        minLength={8}
                      />
                    </label>
                    <label className="space-y-1 text-xs text-slate-300">
                      Confirmation
                      <input
                        type="password"
                        autoComplete="new-password"
                        className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-2 text-sm focus:border-primary focus:outline-none"
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
                        className="rounded-2xl border border-white/20 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
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
                    setActiveSection(item.key);
                    setNavDrawerOpen(false);
                  }}
                  className={`w-full rounded-2xl px-4 py-3 text-left text-base font-semibold transition ${
                    activeSection === item.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-white/5 text-slate-200 hover:bg-white/10"
                  }`}
                >
                  <p>{item.label}</p>
                  <p className="text-xs font-normal text-white/70">{item.description}</p>
                </button>
              ))}
            </div>
          </SheetContent>
        </Sheet>

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
                className="rounded-2xl border border-white/20 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5 disabled:opacity-50"
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
                  <p className="mb-1 text-xs uppercase tracking-[0.4em] text-slate-500">Client</p>
                  <p className="font-semibold">
                    {selectedReservation.customerFirstName} {selectedReservation.customerLastName}
                  </p>
                  <p className="text-slate-300">{selectedReservation.customerPhone}</p>
                </div>
                <div className="rounded-2xl border border-white/10 p-4">
                  <p className="mb-1 text-xs uppercase tracking-[0.4em] text-slate-500">Trajet</p>
                  <p className="font-semibold">
                    {selectedReservation.pickupCity} → {selectedReservation.returnCity}
                  </p>
                  <p className="text-slate-300">
                    {selectedReservation.pickupDate} au {selectedReservation.returnDate}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 p-4">
                  <p className="mb-1 text-xs uppercase tracking-[0.4em] text-slate-500">Véhicule</p>
                  <p>
                    {(() => {
                      const car = cars.find((c) => c.remoteId === selectedReservation.carId);
                      return car ? `${car.brand} ${car.model}` : `ID ${selectedReservation.carId}`;
                    })()}
                  </p>
                  <p className="text-slate-300">Statut: {selectedReservation.status.split("_").join(" ")}</p>
                </div>
                <div className="rounded-2xl border border-white/10 p-4">
                  <p className="mb-1 text-xs uppercase tracking-[0.4em] text-slate-500">Extras</p>
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
                    <p className="mb-1 text-xs uppercase tracking-[0.4em] text-slate-500">Notes / Itinéraire</p>
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
      </main>
      <Footer />
    </div>
  );
};

export default AdminDashboard;
