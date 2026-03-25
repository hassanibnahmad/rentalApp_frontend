import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import Footer from "@/components/Footer";
import FeaturedCars from "@/components/FeaturedCars";
import WhyChooseUs from "@/components/WhyChooseUs";
import ReservationSteps from "@/components/ReservationSteps";
import Testimonials from "@/components/Testimonials";
import ContactSection from "@/components/ContactSection";
import WhatsAppButton from "@/components/WhatsAppButton";
const Index = () => (
  <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <FeaturedCars />
      <WhyChooseUs />
      <ReservationSteps />
      <Testimonials />
      <ContactSection />
      <WhatsAppButton />
      <Footer />
  </div>
);

export default Index;
