import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { CarDetail } from "@/data/cars";
import { cars as seedCars, defaultHighlights } from "@/data/cars";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";

const API_RESOURCE = "/cars";

type ApiGalleryItem = {
  label?: string;
  imageUrl: string;
};

type ApiCarResponse = {
  id: number;
  slug: string;
  brand: string;
  model: string;
  category: string;
  description: string;
  pricePerDay: number;
  transmission: string;
  fuel: string;
  seats: number;
  heroImage?: string;
  whatsappMessage?: string;
  equipments?: string[];
  gallery?: ApiGalleryItem[];
};

type ApiCarPayload = Omit<ApiCarResponse, "id">;

type CarInventoryContextValue = {
  cars: CarDetail[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addCar: (car: CarDetail) => Promise<CarDetail>;
  updateCar: (remoteId: number, car: CarDetail) => Promise<CarDetail>;
  deleteCar: (remoteId: number) => Promise<void>;
  resetCars: () => Promise<void>;
};

const CarInventoryContext = createContext<CarInventoryContextValue | null>(null);

const buildStats = (car: ApiCarResponse | CarDetail) => [
  { label: "Transmission", value: car.transmission },
  { label: "Carburant", value: car.fuel },
  { label: "Capacité", value: `${car.seats} places` },
];

const ensureGallery = (car: ApiCarResponse) => {
  const gallery = (car.gallery ?? []).map((item, index) => ({
    id: `${car.slug}-gallery-${index}`,
    label: item.label ?? `Vue ${index + 1}`,
    image: item.imageUrl,
  }));

  if (gallery.length > 0) {
    return gallery;
  }

  if (car.heroImage) {
    return [{ id: `${car.slug}-hero`, label: "Extérieur", image: car.heroImage }];
  }

  return [];
};

const mapApiCarToCarDetail = (car: ApiCarResponse): CarDetail => {
  const gallery = ensureGallery(car);
  const image = car.heroImage ?? gallery[0]?.image ?? "";

  return {
    id: car.slug ?? `car-${car.id}`,
    remoteId: car.id,
    slug: car.slug,
    brand: car.brand,
    model: car.model,
    category: car.category,
    description: car.description,
    pricePerDay: car.pricePerDay,
    transmission: car.transmission,
    fuel: car.fuel,
    seats: car.seats,
    image,
    gallery,
    stats: buildStats(car),
    equipments: car.equipments ?? [],
    highlights: defaultHighlights,
    whatsappMessage:
      car.whatsappMessage ?? `Bonjour, je souhaite réserver la ${car.brand} ${car.model}.`,
  };
};

const mapCarDetailToApiPayload = (car: CarDetail): ApiCarPayload => {
  const gallery = car.gallery.length
    ? car.gallery
    : [{ id: `${car.slug}-hero`, label: "Extérieur", image: car.image }];

  return {
    slug: car.slug,
    brand: car.brand,
    model: car.model,
    category: car.category,
    description: car.description,
    pricePerDay: car.pricePerDay,
    transmission: car.transmission,
    fuel: car.fuel,
    seats: car.seats,
    heroImage: car.image,
    whatsappMessage: car.whatsappMessage,
    equipments: car.equipments,
    gallery: gallery.map((item) => ({ label: item.label, imageUrl: item.image })),
  };
};

export const CarInventoryProvider = ({ children }: { children: ReactNode }) => {
  const [carList, setCarList] = useState<CarDetail[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();

  const fetchCars = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get<ApiCarResponse[]>(API_RESOURCE);
      setCarList(data.map(mapApiCarToCarDetail));
      setError(null);
    } catch (fetchError) {
      console.error("Erreur lors du chargement des voitures", fetchError);
      setError("Impossible de contacter le serveur. Affichage de la flotte locale.");
      setCarList(seedCars);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCars();
  }, [fetchCars, token]);

  const addCar = useCallback(async (car: CarDetail) => {
    try {
      const payload = mapCarDetailToApiPayload(car);
      const { data } = await apiClient.post<ApiCarResponse>(API_RESOURCE, payload);
      const mapped = mapApiCarToCarDetail(data);
      setCarList((current) => [...current, mapped]);
      return mapped;
    } catch (addError) {
      console.error("Erreur lors de l'ajout d'une voiture", addError);
      setError("Impossible d'ajouter la voiture.");
      throw addError;
    }
  }, []);

  const updateCar = useCallback(async (remoteId: number, car: CarDetail) => {
    try {
      const payload = mapCarDetailToApiPayload(car);
      const { data } = await apiClient.put<ApiCarResponse>(`${API_RESOURCE}/${remoteId}`, payload);
      const mapped = mapApiCarToCarDetail(data);
      setCarList((current) => current.map((item) => (item.remoteId === remoteId ? mapped : item)));
      return mapped;
    } catch (updateError) {
      console.error("Erreur lors de la mise à jour", updateError);
      setError("Impossible de mettre à jour la voiture.");
      throw updateError;
    }
  }, []);

  const deleteCar = useCallback(async (remoteId: number) => {
    try {
      await apiClient.delete(`${API_RESOURCE}/${remoteId}`);
      setCarList((current) => current.filter((car) => car.remoteId !== remoteId));
    } catch (deleteError) {
      console.error("Erreur lors de la suppression", deleteError);
      setError("Impossible de supprimer la voiture.");
      throw deleteError;
    }
  }, []);

  const resetCars = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await apiClient.get<ApiCarResponse[]>(API_RESOURCE);
      await Promise.all(data.map((car) => apiClient.delete(`${API_RESOURCE}/${car.id}`)));
      for (const seed of seedCars) {
        await apiClient.post(API_RESOURCE, mapCarDetailToApiPayload(seed));
      }
      await fetchCars();
    } catch (resetError) {
      console.error("Erreur lors de la réinitialisation", resetError);
      setError("Impossible de réinitialiser la flotte.");
      setCarList(seedCars);
    } finally {
      setLoading(false);
    }
  }, [fetchCars]);

  const value = useMemo(
    () => ({
      cars: carList,
      loading,
      error,
      refresh: fetchCars,
      addCar,
      updateCar,
      deleteCar,
      resetCars,
    }),
    [carList, loading, error, fetchCars, addCar, updateCar, deleteCar, resetCars],
  );

  return <CarInventoryContext.Provider value={value}>{children}</CarInventoryContext.Provider>;
};

export const useCarInventory = () => {
  const context = useContext(CarInventoryContext);
  if (!context) {
    throw new Error("useCarInventory doit être utilisé à l'intérieur de CarInventoryProvider");
  }
  return context;
};
