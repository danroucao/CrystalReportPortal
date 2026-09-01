import { MockUser, MockUserCredential } from './mock-users';

export interface MockAuthenticationProviderModel {
  readonly IsEnabled: boolean;
  readonly DemoUsers: readonly MockUser[];
  GetInitialUsers(): readonly MockUserCredential[];
  Authenticate(Account: string, Password: string): MockUser | null;
}
