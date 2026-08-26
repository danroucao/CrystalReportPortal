import { MockAuthenticationProviderModel } from './mock-authentication.provider.model';

export const MockAuthenticationProvider: MockAuthenticationProviderModel = {
  IsEnabled: false,
  DemoUsers: [],
  Authenticate(): null {
    return null;
  },
};
