export type PublicLicensePlanDecision =
  | { allowed: true; plan: 'Trial' }
  | { allowed: false; status: number; error: string };

/**
 * Public self-serve key issuance may only create Trial licenses.
 * Annual/Lifetime keys require verified payment or an administrator.
 */
export function decidePublicLicenseRequest(plan: unknown): PublicLicensePlanDecision {
  if (plan === 'Annual' || plan === 'Lifetime') {
    return {
      allowed: false,
      status: 403,
      error:
        'Paid access keys cannot be generated from this public endpoint. Register, complete verified SOL checkout, or request an administrator-issued key.',
    };
  }

  return { allowed: true, plan: 'Trial' };
}
