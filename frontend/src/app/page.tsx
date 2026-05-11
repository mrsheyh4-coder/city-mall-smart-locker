import { AdminPanelPreview } from '@/components/luxury/admin-panel-preview';
import { DashboardWidgets } from '@/components/luxury/dashboard-widgets';
import { Footer } from '@/components/luxury/footer';
import { HeroSection } from '@/components/luxury/hero-section';
import { Navbar } from '@/components/luxury/navbar';
import { PaymentSection } from '@/components/luxury/payment-section';
import { QRScanSection } from '@/components/luxury/qr-scan-section';
import { SmartLockerCards } from '@/components/luxury/smart-locker-cards';

export default function Home() {
  return (
    <main className="premium-shell min-h-screen">
      <Navbar />
      <HeroSection />
      <SmartLockerCards />
      <DashboardWidgets />
      <PaymentSection />
      <QRScanSection />
      <AdminPanelPreview />
      <Footer />
    </main>
  );
}
