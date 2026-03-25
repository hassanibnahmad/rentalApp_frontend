import axios from "axios";

type FriendlyOptions = {
  defaultMessage?: string;
  validation?: string;
  unauthorized?: string;
  forbidden?: string;
  notFound?: string;
  conflict?: string;
  network?: string;
};

const extractServerMessage = (payload: unknown) => {
  if (!payload) {
    return undefined;
  }
  if (typeof payload === "string") {
    return payload;
  }
  if (typeof payload === "object" && "message" in payload) {
    const { message } = payload as { message?: unknown };
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }
  return undefined;
};

const getHttpPayload = (input: unknown) => {
  if (axios.isAxiosError(input)) {
    return { status: input.response?.status, data: input.response?.data };
  }
  if (typeof input === "object" && input !== null && "response" in input) {
    const { response } = input as { response?: unknown };
    if (response && typeof response === "object" && "status" in response) {
      const { status, data } = response as { status?: unknown; data?: unknown };
      if (typeof status === "number") {
        return { status, data };
      }
    }
  }
  return null;
};

export const resolveFriendlyError = (issue: unknown, options?: FriendlyOptions) => {
  const fallback = options?.defaultMessage ?? "Un imprévu est survenu. Actualisez la page puis réessayez.";

  const httpPayload = getHttpPayload(issue);
  if (httpPayload) {
    const { status, data } = httpPayload;
    const serverMessage = extractServerMessage(data);
    if (serverMessage) {
      return serverMessage;
    }

    switch (status) {
      case 400:
        return options?.validation ?? "Certaines informations doivent être revues. Vérifiez votre saisie.";
      case 401:
        return options?.unauthorized ?? "Vos identifiants semblent incorrects. Reconnectez-vous.";
      case 403:
        return options?.forbidden ?? "Votre profil n'a pas l'autorisation nécessaire. Contactez votre responsable.";
      case 404:
        return options?.notFound ?? "Nous ne retrouvons pas cet élément. Vérifiez qu'il existe toujours.";
      case 409:
        return options?.conflict ?? "Cette action est déjà enregistrée. Vous pouvez rafraîchir l'écran.";
      default:
        break;
    }
  }

  if (issue instanceof Error) {
    const lower = issue.message.toLowerCase();
    const looksLikeAxiosFallback = /status code \d{3}/i.test(issue.message);
    if (lower.includes("network") || lower.includes("connect")) {
      return options?.network ?? "Connexion momentanément indisponible. Vérifiez votre réseau puis réessayez.";
    }
    if (!looksLikeAxiosFallback && issue.message.trim().length > 0) {
      return issue.message;
    }
  }

  if (typeof issue === "string" && issue.trim().length > 0) {
    return issue;
  }

  return fallback;
};
