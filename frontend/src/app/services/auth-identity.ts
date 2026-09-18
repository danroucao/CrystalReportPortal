export interface BackOfficeAccount {
  readonly Account: string;
  readonly DisplayName: string;
}

// Only FrontUser identities are resolved through the ordinary user/role store.
export type AuthIdentity =
  | { readonly Kind: 'FrontUser'; readonly Account: string }
  | { readonly Kind: 'BackOffice'; readonly Account: string; readonly DisplayName: string };
