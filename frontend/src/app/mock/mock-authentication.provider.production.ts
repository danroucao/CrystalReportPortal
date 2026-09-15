import { MockAuthenticationProviderModel } from './mock-authentication.provider.model';

export const MockAuthenticationProvider: MockAuthenticationProviderModel = {
  IsEnabled: false,
  BackOfficeAccount: null,
  AuthenticateBackOffice(): null { return null; },
  GetInitialUsers() {
    return [];
  },
  Authenticate(): null {
    return null;
  },
};
