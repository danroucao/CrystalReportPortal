import { MockAuthenticationProviderModel } from './mock-authentication.provider.model';
import { MockUsers } from './mock-users';
import { MockUser } from './mock-users';

export const MockAuthenticationProvider: MockAuthenticationProviderModel = {
  IsEnabled: true,
  DemoUsers: MockUsers,
  Authenticate(Account: string, Password: string): MockUser | null {
    return (
      MockUsers.find(
        (MockUser) =>
          MockUser.Account === Account && MockUser.Password === Password,
      ) ?? null
    );
  },
};
