import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertCircle,
  CalendarDays,
  CarFront,
  CheckCircle2,
  Loader2,
  PackageCheck,
  UserRound,
} from "lucide-react";
import axios from "axios";
import jsPDF from "jspdf";

import { useCarInventory } from "@/contexts/CarInventoryContext";
import { apiClient } from "@/lib/api-client";
import { getWhatsAppUrl } from "@/lib/contact-info";
import { useToast } from "@/hooks/use-toast";
import WhatsAppIcon from "@/components/icons/WhatsAppIcon";

const extrasCatalog = [
  {
    id: "gps",
    label: "GPS premium",
    description: "Cartes offline, trafic en direct",
    unitPrice: 50,
  },
  {
    id: "child-seat",
    label: "Siège bébé",
    description: "Normes i-Size 0-4 ans",
    unitPrice: 80,
  },
  {
    id: "wifi",
    label: "Wifi embarqué",
    description: "Routeur 4G, data illimitée",
    unitPrice: 120,
  },
  {
    id: "chauffeur",
    label: "Chauffeur dédié",
    description: "Service business bilingue",
    unitPrice: 400,
  },
] as const;

const citySuggestions = ["Agadir", "Marrakech", "Taghazout", "Casablanca", "Essaouira", "Rabat"];

const steps = [
  { key: "vehicle", title: "Véhicule & période", description: "Choisissez un modèle et vos dates" },
  { key: "profile", title: "Coordonnées", description: "Informations conducteur principal" },
  { key: "extras", title: "Options & confirmation", description: "Services additionnels et notes" },
] as const;

type ReservationFormState = {
  carRemoteId: string;
  pickupCity: string;
  pickupDate: string;
  returnCity: string;
  returnDate: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  documentId: string;
  notes: string;
  extras: Record<string, number>;
};

type ReservationApiResponse = {
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
  totalAmount: number | null;
  extras: string[];
  notes: string | null;
};

type AvailabilityStatus = "idle" | "checking" | "available" | "unavailable" | "error";

const extrasTemplate = extrasCatalog.reduce<Record<string, number>>((acc, extra) => {
  acc[extra.id] = 0;
  return acc;
}, {});

const todayIso = new Date().toISOString().split("T")[0];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD", maximumFractionDigits: 0 }).format(value);

const createInitialFormState = (): ReservationFormState => ({
  carRemoteId: "",
  pickupCity: "Agadir",
  pickupDate: "",
  returnCity: "Agadir",
  returnDate: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  documentId: "",
  notes: "",
  extras: { ...extrasTemplate },
});

const ReservationFlow = () => {
  const { cars } = useCarInventory();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [form, setForm] = useState<ReservationFormState>(() => createInitialFormState());
  const [activeStep, setActiveStep] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<ReservationApiResponse | null>(null);
  const [availabilityStatus, setAvailabilityStatus] = useState<AvailabilityStatus>("idle");
  const [availabilityMessage, setAvailabilityMessage] = useState<string | null>(null);

  const resolvedCarFromQuery = useMemo(() => {
    if (!cars.length) {
      return null;
    }
    const queryCarId = searchParams.get("carId");
    if (queryCarId) {
      const numeric = Number(queryCarId);
      if (!Number.isNaN(numeric)) {
        const remoteMatch = cars.find((car) => car.remoteId === numeric);
        if (remoteMatch) {
          return remoteMatch;
        }
      }
    }
    const querySlug = searchParams.get("carSlug");
    if (querySlug) {
      const slugMatch = cars.find((car) => car.slug === querySlug);
      if (slugMatch) {
        return slugMatch;
      }
    }
    return cars[0] ?? null;
  }, [cars, searchParams]);

  useEffect(() => {
    if (resolvedCarFromQuery?.remoteId) {
      setForm((previous) => {
        if (previous.carRemoteId) {
          return previous;
        }
        return { ...previous, carRemoteId: String(resolvedCarFromQuery.remoteId) };
      });
    }
  }, [resolvedCarFromQuery?.remoteId]);

  useEffect(() => {
    if (searchParams.get("source") !== "admin") {
      return;
    }
    const firstName = searchParams.get("firstName") ?? "";
    const lastName = searchParams.get("lastName") ?? "";
    const email = searchParams.get("email") ?? "";
    const phone = searchParams.get("phone") ?? "";
    if (!firstName && !lastName && !email && !phone) {
      return;
    }
    setForm((previous) => ({
      ...previous,
      firstName: previous.firstName || firstName,
      lastName: previous.lastName || lastName,
      email: previous.email || email,
      phone: previous.phone || phone,
    }));
    setActiveStep((previous) => (previous < 1 ? 1 : previous));
  }, [searchParams]);

  useEffect(() => {
    setAvailabilityStatus("idle");
    setAvailabilityMessage(null);
  }, [form.carRemoteId, form.pickupDate, form.returnDate]);

  const selectedCar = useMemo(() => {
    if (form.carRemoteId) {
      const numeric = Number(form.carRemoteId);
      if (!Number.isNaN(numeric)) {
        const match = cars.find((car) => car.remoteId === numeric);
        if (match) {
          return match;
        }
      }
    }
    return resolvedCarFromQuery ?? null;
  }, [form.carRemoteId, cars, resolvedCarFromQuery]);

  const rentalDays = useMemo(() => {
    if (!form.pickupDate || !form.returnDate) {
      return 0;
    }
    const start = new Date(form.pickupDate);
    const end = new Date(form.returnDate);
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) {
      return 0;
    }
    return Math.max(diff, 1);
  }, [form.pickupDate, form.returnDate]);

  const extrasTotal = useMemo(
    () =>
      extrasCatalog.reduce((sum, extra) => {
        const quantity = form.extras[extra.id] ?? 0;
        return sum + quantity * extra.unitPrice;
      }, 0),
    [form.extras],
  );

  const rentalTotal = selectedCar && rentalDays > 0 ? rentalDays * selectedCar.pricePerDay : 0;
  const estimatedTotal = rentalTotal + extrasTotal;

  const summaryCarForSuccess = useMemo(() => {
    if (!successData) {
      return null;
    }
    return cars.find((car) => car.remoteId === successData.carId) ?? null;
  }, [successData, cars]);

  const reservationSummary = successData
    ? (() => {
        const carLabel = summaryCarForSuccess
          ? `${summaryCarForSuccess.brand} ${summaryCarForSuccess.model}`
          : `ID ${successData.carId}`;
        const extrasSelected = extrasCatalog
          .map((extra) => {
            const quantity = form.extras[extra.id];
            if (!quantity) {
              return null;
            }
            return `${extra.label} x${quantity}`;
          })
          .filter((item): item is string => Boolean(item));
        const sanitizedNotes = form.notes.trim();
        const amountDisplay = successData.totalAmount
          ? formatCurrency(successData.totalAmount)
          : estimatedTotal
          ? formatCurrency(estimatedTotal)
          : "À confirmer";
        const lines = [
          `Client : ${successData.customerFirstName} ${successData.customerLastName}`,
          `Email : ${successData.customerEmail}`,
          `Téléphone : ${successData.customerPhone}`,
          `Document : ${form.documentId.trim() || "Non communiqué"}`,
          `Véhicule : ${carLabel}`,
          `Période : ${successData.pickupDate} → ${successData.returnDate}`,
          `Trajet : ${successData.pickupCity} → ${successData.returnCity}`,
          extrasSelected.length ? `Extras : ${extrasSelected.join(", ")}` : "Extras : Aucun",
          sanitizedNotes ? `Notes : ${sanitizedNotes}` : "Notes : Aucune",
          `Montant estimé : ${amountDisplay}`,
        ];
        return {
          title: `Réservation #${successData.id}`,
          lines,
        };
      })()
    : null;

  const whatsappMessage = reservationSummary
    ? ["Nouvelle demande Julia Auto Cars", reservationSummary.title, ...reservationSummary.lines].join("\n")
    : undefined;

  const whatsappUrl = getWhatsAppUrl(whatsappMessage);

  const isCheckingAvailability = activeStep === 0 && availabilityStatus === "checking";

  const clearFieldError = (field: string) => {
    setFieldErrors((previous) => {
      if (!previous[field]) {
        return previous;
      }
      const next = { ...previous };
      delete next[field];
      return next;
    });
  };

  const updateField = (field: keyof ReservationFormState, value: string) => {
    setForm((previous) => {
      const next = { ...previous, [field]: value };
      if (field === "pickupDate" && next.returnDate) {
        const pickupDate = new Date(value);
        const returnDate = new Date(next.returnDate);
        if (returnDate.getTime() < pickupDate.getTime()) {
          next.returnDate = value;
        }
      }
      return next;
    });
    clearFieldError(field);
  };

  const updateExtra = (id: string, quantity: number) => {
    setForm((previous) => ({
      ...previous,
      extras: { ...previous.extras, [id]: Math.max(0, quantity) },
    }));
  };

  const checkAvailability = async () => {
    if (!selectedCar?.remoteId || !form.pickupDate || !form.returnDate) {
      setAvailabilityStatus("error");
      setAvailabilityMessage("Sélectionnez un véhicule et un créneau complet pour vérifier la disponibilité.");
      return false;
    }
    setAvailabilityStatus("checking");
    setAvailabilityMessage("Vérification en cours avec notre back-office...");
    try {
      const { data } = await apiClient.get<boolean>("/availability", {
        params: {
          carId: selectedCar.remoteId,
          start: form.pickupDate,
          end: form.returnDate,
        },
      });
      if (data) {
        setAvailabilityStatus("available");
        setAvailabilityMessage("Créneau confirmé, vous pouvez poursuivre.");
        return true;
      }
      setAvailabilityStatus("unavailable");
      setAvailabilityMessage("Ce véhicule est déjà réservé sur ces dates. Essayez un autre créneau.");
      return false;
    } catch {
      setAvailabilityStatus("error");
      setAvailabilityMessage("Impossible de vérifier la disponibilité. Réessayez d'ici quelques secondes.");
      return false;
    }
  };

  const validateStep = (stepIndex: number) => {
    const nextErrors: Record<string, string> = {};
    if (stepIndex === 0) {
      if (!selectedCar?.remoteId) {
        nextErrors.carRemoteId =
          "Ce véhicule n'est pas encore synchronisé. Merci de choisir un modèle publié via le back-office.";
      }
      if (!form.pickupCity.trim()) {
        nextErrors.pickupCity = "Ville de départ obligatoire.";
      }
      if (!form.returnCity.trim()) {
        nextErrors.returnCity = "Ville de retour obligatoire.";
      }
      if (!form.pickupDate) {
        nextErrors.pickupDate = "Date de départ obligatoire.";
      }
      if (!form.returnDate) {
        nextErrors.returnDate = "Date de retour obligatoire.";
      }
      if (form.pickupDate && form.returnDate) {
        const start = new Date(form.pickupDate);
        const end = new Date(form.returnDate);
        if (end.getTime() < start.getTime()) {
          nextErrors.returnDate = "La date de retour doit être postérieure à la prise en charge.";
        }
      }
    }
    if (stepIndex === 1) {
      if (!form.firstName.trim()) {
        nextErrors.firstName = "Prénom obligatoire.";
      }
      if (!form.lastName.trim()) {
        nextErrors.lastName = "Nom obligatoire.";
      }
      if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
        nextErrors.email = "Email invalide.";
      }
      if (!form.phone.trim()) {
        nextErrors.phone = "Téléphone obligatoire.";
      }
      if (!form.documentId.trim()) {
        nextErrors.documentId = "Numéro de document requis.";
      }
    }
    if (stepIndex === 2 && !selectedCar?.remoteId) {
      nextErrors.carRemoteId = "Veuillez sélectionner un véhicule disponible.";
    }
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleNext = async () => {
    if (!validateStep(activeStep)) {
      return;
    }

    if (activeStep === 0) {
      const available = await checkAvailability();
      if (!available) {
        return;
      }
    }

    setActiveStep((previous) => Math.min(previous + 1, steps.length - 1));
    setApiError(null);
  };

  const handlePrev = () => {
    setActiveStep((previous) => Math.max(previous - 1, 0));
    setApiError(null);
  };

  const handleSubmit = async () => {
    if (!validateStep(activeStep)) {
      return;
    }
    if (!selectedCar?.remoteId) {
      return;
    }
    setSubmitting(true);
    setApiError(null);
    try {
      const payload = {
        carId: Number(selectedCar.remoteId),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        documentId: form.documentId.trim(),
        pickupCity: form.pickupCity.trim(),
        pickupDate: form.pickupDate,
        returnCity: form.returnCity.trim(),
        returnDate: form.returnDate,
        notes: form.notes.trim() || undefined,
        extras: extrasCatalog
          .filter((extra) => (form.extras[extra.id] ?? 0) > 0)
          .map((extra) => ({
            label: extra.label,
            quantity: form.extras[extra.id],
            unitPrice: extra.unitPrice,
          })),
      };
      const { data } = await apiClient.post<ReservationApiResponse>("/reservations", payload);
      setSuccessData(data);
      toast({
        title: "Demande transmise",
        description: "Notre équipe prépare la confirmation.",
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        setApiError(error.response?.data?.message ?? "Impossible d'enregistrer la réservation.");
      } else {
        setApiError("Impossible d'enregistrer la réservation.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartNew = () => {
    setForm((previous) => ({ ...createInitialFormState(), carRemoteId: previous.carRemoteId }));
    setActiveStep(0);
    setFieldErrors({});
    setApiError(null);
    setSuccessData(null);
    setAvailabilityStatus("idle");
    setAvailabilityMessage(null);
  };

  const handleDownloadPdf = () => {
    if (!reservationSummary || !successData) {
      return;
    }
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Résumé de réservation", 14, 18);
    doc.setFontSize(13);
    doc.text(reservationSummary.title, 14, 28);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    let cursorY = 38;
    reservationSummary.lines.forEach((line) => {
      const wrapped = doc.splitTextToSize(line, 180);
      doc.text(wrapped, 14, cursorY);
      cursorY += wrapped.length * 6;
    });
    doc.save(`reservation-${successData.id}.pdf`);
  };

  const renderFieldError = (field: string) =>
    fieldErrors[field] ? <p className="mt-1 text-xs text-rose-400">{fieldErrors[field]}</p> : null;

  const successView = successData ? (
    <section className="rounded-[32px] border border-emerald-500/30 bg-emerald-500/10 p-8 text-white">
      <div className="flex items-center gap-3 text-emerald-200">
        <CheckCircle2 className="h-6 w-6" />
        <div>
          <p className="text-sm uppercase tracking-[0.4em]">Demande envoyée</p>
          <p className="text-2xl font-display font-semibold">Réservation #{successData.id}</p>
        </div>
      </div>
      <p className="mt-4 text-slate-100">
        Votre réservation est enregistrée. Le concierge vérifie la disponibilité et vous contacte pour confirmer le
        paiement. Elle apparaît déjà dans l'espace administrateur.
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/15 bg-black/30 p-4">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Période</p>
          <p className="text-lg font-semibold">{successData.pickupDate} → {successData.returnDate}</p>
          <p className="text-sm text-slate-400">
            {successData.pickupCity} / {successData.returnCity}
          </p>
        </div>
        <div className="rounded-2xl border border-white/15 bg-black/30 p-4">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Client</p>
          <p className="text-lg font-semibold">
            {successData.customerFirstName} {successData.customerLastName}
          </p>
          <p className="text-sm text-slate-400">{successData.customerEmail}</p>
        </div>
      </div>
      {summaryCarForSuccess && (
        <div className="mt-6 rounded-2xl border border-white/15 bg-black/40 p-4">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Véhicule réservé</p>
          <p className="text-lg font-semibold">
            {summaryCarForSuccess.brand} {summaryCarForSuccess.model}
          </p>
          <p className="text-sm text-slate-400">{summaryCarForSuccess.pricePerDay} MAD / jour</p>
        </div>
      )}
      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => navigate("/voitures")}
          className="inline-flex flex-1 min-w-[180px] items-center justify-center rounded-2xl border border-white/30 px-5 py-3 text-sm font-semibold text-white hover:border-white/60"
        >
          Retour au catalogue
        </button>
        <button
          type="button"
          onClick={handleStartNew}
          className="inline-flex flex-1 min-w-[180px] items-center justify-center rounded-2xl bg-white text-black px-5 py-3 text-sm font-semibold"
        >
          Nouvelle demande
        </button>
        {reservationSummary && (
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="inline-flex flex-1 min-w-[180px] items-center justify-center gap-2 rounded-2xl border border-white/30 px-5 py-3 text-sm font-semibold text-white hover:border-white/60"
          >
            <PackageCheck className="h-4 w-4" /> Télécharger votre reservation
          </button>
        )}
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex flex-1 min-w-[180px] items-center justify-center gap-2 rounded-2xl border border-emerald-400/40 px-5 py-3 text-sm font-semibold text-emerald-100 hover:text-emerald-50"
        >
          <WhatsAppIcon className="h-4 w-4" /> Informer via WhatsApp
        </a>
      </div>
    </section>
  ) : null;

  if (successView) {
    return (
      <motion.div initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} className="mt-10">
        {successView}
      </motion.div>
    );
  }

  return (
    <motion.section initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} className="mt-10">
      <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 text-white">
        <div className="grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => {
            const reached = index < activeStep;
            const current = index === activeStep;
            return (
              <div key={step.key} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold ${
                      current
                        ? "border-white bg-white text-black"
                        : reached
                        ? "border-emerald-400 text-emerald-300"
                        : "border-white/20 text-slate-400"
                    }`}
                  >
                    {reached ? <CheckCircle2 className="h-5 w-5" /> : index + 1}
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Étape {index + 1}</p>
                    <p className="text-sm font-semibold text-white">{step.title}</p>
                    <p className="text-xs text-slate-400">{step.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {activeStep === 0 && (
          <div className="mt-8 space-y-8">
            <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
              <div className="space-y-4">
                <label className="text-xs uppercase tracking-[0.4em] text-slate-400">Véhicule</label>
                <select
                  value={form.carRemoteId}
                  onChange={(event) => updateField("carRemoteId", event.target.value)}
                  className="w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white"
                >
                  <option value="">Sélectionner une voiture synchronisée</option>
                  {cars.map((car) => (
                    <option
                      key={car.slug}
                      value={car.remoteId ? String(car.remoteId) : ""}
                      disabled={!car.remoteId}
                    >
                      {car.brand} {car.model}
                      {!car.remoteId ? " (brouillon)" : ""}
                    </option>
                  ))}
                </select>
                {renderFieldError("carRemoteId")}
              </div>
              {selectedCar && (
                <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
                  <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Résumé</p>
                  <p className="mt-2 text-xl font-display font-semibold">
                    {selectedCar.brand} {selectedCar.model}
                  </p>
                  <p className="text-sm text-slate-300">{selectedCar.pricePerDay} MAD / jour</p>
                  <p className="mt-4 text-sm text-slate-400">{selectedCar.description}</p>
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs uppercase tracking-[0.4em] text-slate-400">Ville de départ</label>
                <input
                  type="text"
                  value={form.pickupCity}
                  onChange={(event) => updateField("pickupCity", event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm"
                  placeholder="Ex. Agadir"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {citySuggestions.map((city) => (
                    <button
                      type="button"
                      key={`pickup-${city}`}
                      className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300 hover:border-white/40"
                      onClick={() => updateField("pickupCity", city)}
                    >
                      {city}
                    </button>
                  ))}
                </div>
                {renderFieldError("pickupCity")}
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.4em] text-slate-400">Ville de retour</label>
                <input
                  type="text"
                  value={form.returnCity}
                  onChange={(event) => updateField("returnCity", event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm"
                  placeholder="Ex. Marrakech"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {citySuggestions.map((city) => (
                    <button
                      type="button"
                      key={`return-${city}`}
                      className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300 hover:border-white/40"
                      onClick={() => updateField("returnCity", city)}
                    >
                      {city}
                    </button>
                  ))}
                </div>
                {renderFieldError("returnCity")}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs uppercase tracking-[0.4em] text-slate-400">Prise en charge</label>
                <input
                  type="date"
                  min={todayIso}
                  value={form.pickupDate}
                  onChange={(event) => updateField("pickupDate", event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm"
                />
                {renderFieldError("pickupDate")}
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.4em] text-slate-400">Retour</label>
                <input
                  type="date"
                  min={form.pickupDate || todayIso}
                  value={form.returnDate}
                  onChange={(event) => updateField("returnDate", event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm"
                />
                {renderFieldError("returnDate")}
              </div>
            </div>

            {availabilityStatus !== "idle" && availabilityMessage && (
              <div
                className={`rounded-3xl border px-4 py-3 text-sm ${
                  availabilityStatus === "available"
                    ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-50"
                    : availabilityStatus === "unavailable"
                    ? "border-rose-400/40 bg-rose-500/10 text-rose-100"
                    : availabilityStatus === "error"
                    ? "border-amber-400/40 bg-amber-500/10 text-amber-100"
                    : "border-white/15 bg-white/5 text-slate-200"
                }`}
              >
                {availabilityMessage}
              </div>
            )}
          </div>
        )}

        {activeStep === 1 && (
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div>
              <label className="text-xs uppercase tracking-[0.4em] text-slate-400">Prénom</label>
              <input
                type="text"
                value={form.firstName}
                onChange={(event) => updateField("firstName", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm"
                placeholder="Ex. Sara"
              />
              {renderFieldError("firstName")}
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.4em] text-slate-400">Nom</label>
              <input
                type="text"
                value={form.lastName}
                onChange={(event) => updateField("lastName", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm"
                placeholder="Ex. El Amrani"
              />
              {renderFieldError("lastName")}
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.4em] text-slate-400">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm"
                placeholder="vous@email.com"
              />
              {renderFieldError("email")}
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.4em] text-slate-400">Téléphone / WhatsApp</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(event) => updateField("phone", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm"
                placeholder="+212..."
              />
              {renderFieldError("phone")}
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.4em] text-slate-400">Passeport ou CIN</label>
              <input
                type="text"
                value={form.documentId}
                onChange={(event) => updateField("documentId", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm"
                placeholder="AA123456"
              />
              {renderFieldError("documentId")}
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Confidentialité</p>
              <p className="text-sm text-slate-300">
                Ces informations ne sont utilisées que pour préparer votre contrat et vérifier votre éligibilité à la
                location.
              </p>
            </div>
          </div>
        )}

        {activeStep === 2 && (
          <div className="mt-8 space-y-8">
            <div className="grid gap-4 md:grid-cols-2">
              {extrasCatalog.map((extra) => {
                const quantity = form.extras[extra.id] ?? 0;
                return (
                  <div key={extra.id} className="rounded-3xl border border-white/10 bg-black/30 p-4">
                    <p className="text-sm font-semibold text-white">{extra.label}</p>
                    <p className="text-xs text-slate-400">{extra.description}</p>
                    <p className="mt-2 text-sm text-slate-300">{extra.unitPrice} MAD / unité</p>
                    <div className="mt-4 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => updateExtra(extra.id, quantity - 1)}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-lg"
                      >
                        –
                      </button>
                      <span className="w-12 text-center text-lg font-semibold">{quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateExtra(extra.id, quantity + 1)}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-lg"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid gap-6 md:grid-cols-[1.1fr,0.9fr]">
              <div>
                <label className="text-xs uppercase tracking-[0.4em] text-slate-400">Notes au concierge</label>
                <textarea
                  value={form.notes}
                  onChange={(event) => updateField("notes", event.target.value)}
                  rows={5}
                  className="mt-2 w-full rounded-3xl border border-white/15 bg-black/30 px-4 py-3 text-sm"
                  placeholder="Numéro de vol, heure d'arrivée, demandes spécifiques..."
                />
              </div>
              <div className="rounded-3xl border border-white/10 bg-black/30 p-5 space-y-3">
                <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Estimation</p>
                <div className="flex items-center justify-between text-sm text-slate-300">
                  <span>Durée</span>
                  <span>{rentalDays ? `${rentalDays} jour(s)` : "-"}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-300">
                  <span>Location</span>
                  <span>{rentalTotal ? formatCurrency(rentalTotal) : "-"}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-300">
                  <span>Extras</span>
                  <span>{extrasTotal ? formatCurrency(extrasTotal) : "-"}</span>
                </div>
                <div className="flex items-center justify-between text-lg font-semibold text-white">
                  <span>Total indicatif</span>
                  <span>{estimatedTotal ? formatCurrency(estimatedTotal) : "-"}</span>
                </div>
                <p className="text-xs text-slate-400">
                  Montant indicatif, ajusté par l'administrateur selon disponibilité et options.
                </p>
              </div>
            </div>
          </div>
        )}

        {apiError && (
          <div className="mt-6 flex items-center gap-2 rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            <AlertCircle className="h-4 w-4" /> {apiError}
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          {activeStep > 0 && (
            <button
              type="button"
              onClick={handlePrev}
              className="inline-flex flex-1 min-w-[160px] items-center justify-center rounded-2xl border border-white/20 px-5 py-3 text-sm font-semibold text-white hover:border-white/50"
            >
              Retour
            </button>
          )}
          {activeStep < steps.length - 1 && (
            <button
              type="button"
              onClick={handleNext}
              disabled={isCheckingAvailability}
              className="inline-flex flex-1 min-w-[160px] items-center justify-center gap-2 rounded-2xl bg-white text-black px-5 py-3 text-sm font-semibold disabled:opacity-70"
            >
              {isCheckingAvailability ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Étape suivante
            </button>
          )}
          {activeStep === steps.length - 1 && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex flex-1 min-w-[200px] items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[0_20px_55px_rgba(59,130,246,0.45)] disabled:opacity-70"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Confirmer ma réservation
            </button>
          )}
        </div>
      </div>
    </motion.section>
  );
};

export default ReservationFlow;
