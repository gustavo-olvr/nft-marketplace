export const lighthouseConfig = {
  port: 4173,
  runsPerTarget: 3,
  outputDir: 'lighthouse/reports',
  pages: [
    { name: 'inicio', path: '/' },
    { name: 'detalhe-nft', path: '/nfts/nft_2' },
  ],
  profiles: ['mobile', 'desktop'],
  categories: ['performance', 'accessibility', 'best-practices', 'seo'],
  thresholds: { performance: 90, accessibility: 95, 'best-practices': 95, seo: 90 },
}
