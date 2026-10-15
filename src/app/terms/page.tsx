import type { Metadata } from 'next';
import { PageHero } from '@/components/ui';

export const metadata: Metadata = { title: 'Terms of use' };

export default function TermsPage() {
  return (
    <>
      <PageHero crumb="Terms of use" title="Terms of use" />
      <section className="container-site max-w-[760px] py-12">
        <p className="m-0">[Terms of use to be provided by SCBNG leadership.]</p>
      </section>
    </>
  );
}
