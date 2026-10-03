// Adapter boundary for a future external IČO registry. Registration never claims verification.
export type BusinessVerification={ico:string;name:string;address:string;source:string;checkedAt:string};
export interface BusinessRegistry {verify(ico:string):Promise<BusinessVerification|null>}
// Wire a registry into a server-side job, compare its returned IČO, and persist
// verification_status/source/verified_at only after a successful trusted response.
// No role or entitlement may be granted by this adapter.
