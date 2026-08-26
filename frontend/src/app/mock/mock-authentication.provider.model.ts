import { MockUser } from './mock-users';

export interface MockAuthenticationProviderModel {
  readonly IsEnabled: boolean;
  readonly DemoUsers: readonly MockUser[];
  Authenticate(Account: string, Password: string): MockUser | null;
}
