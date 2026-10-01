/**
 * App-wide feature switches. Hidden features keep their code, API and data —
 * only their entry points (nav, routes, dashboard cards, form fields) are gated,
 * so flipping a flag back to `true` restores them unchanged.
 */
export const FEATURES = {
  /** Baithul Maal contributions: hidden for every role (state/district/area admins and members). */
  baithulMaal: false,
} as const;
