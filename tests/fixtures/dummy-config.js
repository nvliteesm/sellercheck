// DUMMY FIXTURE for SellerCheck SG tests. Every value below is invented.
// None of these keys or passwords are real or have ever been issued.
// Expected: 2 blockers (cloud access key, payment token), 1 review (hard-coded password).

module.exports = {
  region: 'ap-southeast-1',
  aws: {
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  },
  payments: {
    stripeKey: 'sk_live_FAKE_0000_DUMMY_0000_NOT_REAL',
  },
  database: {
    host: 'db.internal.example',
    user: 'storefront',
    password: 'Kopi-Siew-Dai-2026!',
  },
}
