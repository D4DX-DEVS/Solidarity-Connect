// Server-side mirror of the frontend's lib/features.ts. Hidden features keep
// their routes and data; only what leaks into shared outputs (exports) is gated.
// Set BAITHUL_MAAL_ENABLED=true to bring Baithul Maal columns back.
export const BAITHUL_MAAL_ENABLED = process.env.BAITHUL_MAAL_ENABLED === 'true';
