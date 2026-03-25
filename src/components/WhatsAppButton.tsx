import WhatsAppIcon from "@/components/icons/WhatsAppIcon";
import { contactDetails, getWhatsAppUrl } from "@/lib/contact-info";

const WhatsAppButton = () => {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "/";

  if (pathname === "/admin") {
    return null;
  }

  const handleWhatsAppClick = () => {
    window.open(getWhatsAppUrl(contactDetails.whatsapp.defaultMessage), "_blank", "noopener,noreferrer");
  };

  return (
    <button
      type="button"
      onClick={handleWhatsAppClick}
      className="fixed bottom-6 right-6 z-50 rounded-full border border-white/10 bg-[#0b1424] p-4 text-white shadow-lg transition-transform duration-300 hover:scale-105 hover:bg-[#121d35]"
      aria-label="Contacter via WhatsApp"
    >
      <WhatsAppIcon className="h-8 w-8" />
    </button>
  );
};

export default WhatsAppButton;
