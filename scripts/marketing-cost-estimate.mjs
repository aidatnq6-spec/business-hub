const fx = 30000;
const rows = {
  text: 1 * 0.25 + 0.5 * 1.5,
  images: 120 * 0.0336,
  imageOverhead: 1,
  speech: (162000 / 1e6) * 16,
  search: (100 / 1000) * 14,
};
const usd = Object.values(rows).reduce((a, b) => a + b, 0);
console.log(
  JSON.stringify(
    {
      mode: 'offline-estimate-not-an-invoice',
      fxAssumption: fx,
      rows,
      aiBaseUsd: usd,
      aiBaseVnd: Math.ceil(usd * fx),
      aiWith50PercentReserveVnd: Math.ceil(usd * fx * 1.5),
      aiMonthlyCapVnd: 1000000,
      schedulerWorstCaseUsd: 0.2,
      infrastructureEnvelopeVnd: [100000, 200000],
      benchmarkVerified: false,
    },
    null,
    2,
  ),
);
