import localFont from 'next/font/local';

// Self-hosted from @fontsource so builds don't depend on reaching Google Fonts.
export const jakarta = localFont({
  src: '../../node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2',
  variable: '--font-jakarta',
  weight: '200 800',
  display: 'swap',
});

export const sourceSans = localFont({
  src: '../../node_modules/@fontsource-variable/source-sans-3/files/source-sans-3-latin-wght-normal.woff2',
  variable: '--font-source',
  weight: '200 900',
  display: 'swap',
});
