type PhoneContact = {
  display: string;
  dial: string;
};

const valueOrFallback = (value: string | undefined, fallback: string): string => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return fallback;
};

const createPhoneContact = (
  displayValue: string | undefined,
  dialValue: string | undefined,
  fallbackDisplay: string,
  fallbackDial: string,
): PhoneContact => ({
  display: valueOrFallback(displayValue, fallbackDisplay),
  dial: valueOrFallback(dialValue, fallbackDial),
});

const fallbackPrimaryDisplay = "+212 6 61 93 08 18";
const fallbackPrimaryDial = "+212661930818";
const fallbackSecondaryDisplay = "+212 6 57 44 66 30";
const fallbackSecondaryDial = "+212657446630";
const fallbackConciergeDisplay = "+212 600 11 22 33";
const fallbackConciergeDial = "+212600112233";
const fallbackEmail = "JuliaAutoCars@gmail.com";
const fallbackAddress = "N°2 Avenue Abdellah Ben Hssain N°65, Hay Salam, Agadir";
const fallbackMapsLink = "https://maps.google.com/?q=Agadir+Hay+Salam";
const fallbackMapsEmbedUrl =
  "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3441.6!2d-9.5981!3d30.4278!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMzDCsDI1JzQwLjEiTiA5wrAzNSc1My4yIlc!5e0!3m2!1sfr!2sma!4v1";
const fallbackWhatsappMessage = "Bonjour Julia Auto Cars, je souhaite des informations sur vos services.";

const primaryPhone = createPhoneContact(
  import.meta.env.VITE_CONTACT_PHONE_PRIMARY_DISPLAY,
  import.meta.env.VITE_CONTACT_PHONE_PRIMARY_DIAL,
  fallbackPrimaryDisplay,
  fallbackPrimaryDial,
);
const secondaryPhone = createPhoneContact(
  import.meta.env.VITE_CONTACT_PHONE_SECONDARY_DISPLAY,
  import.meta.env.VITE_CONTACT_PHONE_SECONDARY_DIAL,
  fallbackSecondaryDisplay,
  fallbackSecondaryDial,
);
const conciergePhone = createPhoneContact(
  import.meta.env.VITE_CONTACT_PHONE_CONCIERGE_DISPLAY,
  import.meta.env.VITE_CONTACT_PHONE_CONCIERGE_DIAL,
  fallbackConciergeDisplay,
  fallbackConciergeDial,
);

const whatsappPhone = valueOrFallback(import.meta.env.VITE_CONTACT_WHATSAPP_PHONE, primaryPhone.dial);

export const contactDetails = {
  email: valueOrFallback(import.meta.env.VITE_CONTACT_EMAIL, fallbackEmail),
  address: valueOrFallback(import.meta.env.VITE_CONTACT_ADDRESS, fallbackAddress),
  maps: {
    link: valueOrFallback(import.meta.env.VITE_CONTACT_MAPS_LINK, fallbackMapsLink),
    embedUrl: valueOrFallback(import.meta.env.VITE_CONTACT_MAPS_EMBED_URL, fallbackMapsEmbedUrl),
  },
  phones: {
    primary: primaryPhone,
    secondary: secondaryPhone,
    concierge: conciergePhone,
  },
  whatsapp: {
    phone: whatsappPhone,
    defaultMessage: valueOrFallback(
      import.meta.env.VITE_CONTACT_WHATSAPP_DEFAULT_MESSAGE,
      fallbackWhatsappMessage,
    ),
  },
};

const stripNonDigits = (value: string): string => value.replace(/\D/g, "");
const normalizeDial = (dial: string): string => dial.replace(/\s+/g, "");

export const formatPhoneHref = (dial: string): string => `tel:${normalizeDial(dial)}`;

export const getWhatsAppUrl = (message?: string): string => {
  const normalized = stripNonDigits(contactDetails.whatsapp.phone) || stripNonDigits(contactDetails.phones.primary.dial);
  const baseUrl = `https://wa.me/${normalized}`;
  return message ? `${baseUrl}?text=${encodeURIComponent(message)}` : baseUrl;
};
