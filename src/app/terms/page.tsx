import type { Metadata } from 'next';
import { PageHero } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Terms of use',
  description: 'The terms for using the Bay Area Referral Partners website.',
};

export default function TermsPage() {
  return (
    <>
      <PageHero crumb="Terms of use" title="Terms of use" />
      <section className="container-site max-w-[760px] py-12">
        <p className="m-0">[Terms of use to be provided by group leadership.]</p>
      </section>
    </>
  );
}
