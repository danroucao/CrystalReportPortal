import { MockAuthenticationProviderModel } from './mock-authentication.provider.model';

export const MockAuthenticationProvider: MockAuthenticationProviderModel = {
  IsEnabled: false,
  DemoUsers: [],
  GetInitialUsers() {
    return [];
  },
  Authenticate(): null {
    return null;
  },
};
