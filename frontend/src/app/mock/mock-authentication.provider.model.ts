import { BackOfficeAccount } from '../services/auth-identity';
import { MockUser, MockUserCredential } from './mock-users';

export interface MockAuthenticationProviderModel {
  readonly IsEnabled: boolean;
  readonly BackOfficeAccount: BackOfficeAccount | null;
  AuthenticateBackOffice(Account: string, Password: string): BackOfficeAccount | null;
  readonly DemoUsers: readonly MockUser[];
  GetInitialUsers(): readonly MockUserCredential[];
  Authenticate(Account: string, Password: string): MockUser | null;
}
