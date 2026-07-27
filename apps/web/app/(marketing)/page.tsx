import HeroSection from '@/components/marketing/hero';
import FeatureGrid from '@/components/marketing/feature-grid';
import HowItWorks from '@/components/marketing/how-it-works';
import PricingTeaser from '@/components/marketing/pricing-teaser';
import Testimonials from '@/components/marketing/testimonials';
import FAQ from '@/components/marketing/faq';

function SectionDivider() {
  return <div className="mx-auto h-px max-w-5xl bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />;
}

export default function MarketingPage() {
  return (
    <>
      <section>
        <HeroSection />
      </section>
      <SectionDivider />
      <section className="container mx-auto px-4 py-20">
        <h2 className="mb-12 text-center text-3xl font-bold">
          Everything you need to generate AI video
        </h2>
        <FeatureGrid />
      </section>
      <SectionDivider />
      <section className="container mx-auto px-4 py-20">
        <h2 className="mb-12 text-center text-3xl font-bold">How it works</h2>
        <HowItWorks />
      </section>
      <SectionDivider />
      <section className="container mx-auto px-4 py-20">
        <h2 className="mb-12 text-center text-3xl font-bold">
          Simple, transparent pricing
        </h2>
        <PricingTeaser />
      </section>
      <SectionDivider />
      <section className="container mx-auto px-4 py-20">
        <h2 className="mb-12 text-center text-3xl font-bold">
          Loved by teams everywhere
        </h2>
        <Testimonials />
      </section>
      <SectionDivider />
      <section className="container mx-auto px-4 py-20">
        <h2 className="mb-12 text-center text-3xl font-bold">Frequently asked questions</h2>
        <FAQ />
      </section>
    </>
  );
}
