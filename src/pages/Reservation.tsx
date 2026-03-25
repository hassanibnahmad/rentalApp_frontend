import Navbar from "@/components/Navbar";
import ReservationSteps from "@/components/ReservationSteps";
import Footer from "@/components/Footer";
import ReservationFlow from "@/components/ReservationFlow";

const Reservation = () => (
  <div className="min-h-screen bg-[#01030F] text-white">
    <Navbar />
    <main className="pt-24 pb-20">
      <section className="mx-auto max-w-3xl px-4 text-center">
        <p className="text-xs uppercase tracking-[0.5em] text-slate-400">Conciergerie privée</p>
        <h1 className="mt-4 text-4xl font-display font-semibold leading-tight md:text-5xl">
          Finalisez votre réservation en ligne
        </h1>
        <p className="mt-4 text-base text-slate-300">
          Sélectionnez vos dates, partagez vos coordonnées puis validez vos options. Chaque demande est vérifiée en
          temps réel par notre équipe afin d'apparaître instantanément dans le tableau de bord admin.
        </p>
      </section>

      <div className="mt-12">
        <ReservationSteps />
      </div>

      <div className="container mx-auto px-4">
        <ReservationFlow />
      </div>
    </main>
    <Footer />
  </div>
);

export default Reservation;
