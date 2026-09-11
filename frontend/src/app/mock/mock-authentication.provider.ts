import { MockAuthenticationProviderModel } from './mock-authentication.provider.model';
import { MockUser, MockUserCredential, MockUsers } from './mock-users';

const ToReadModel = ({ Password: _, Roles, ...User }: MockUserCredential): MockUser => ({
  ...User,
  Roles: [...Roles],
});

export const MockAuthenticationProvider: MockAuthenticationProviderModel = {
  IsEnabled: true,
  BackOfficeAccount: { Account: 'admin@example.com', DisplayName: '系統設定' },
  AuthenticateBackOffice(Account: string, Password: string) {
    // Development-only credential; excluded by the production file replacement.
    return Account === 'admin@example.com' && Password === 'admin123'
      ? { Account, DisplayName: '系統設定' } : null;
  },
  DemoUsers: MockUsers.map(ToReadModel),
  GetInitialUsers(): readonly MockUserCredential[] {
    return MockUsers.map((User) => ({ ...User, Roles: [...User.Roles] }));
  },
  Authenticate(Account: string, Password: string): MockUser | null {
    const User = MockUsers.find(
      (Entry) => Entry.Account === Account && Entry.Password === Password && Entry.Enabled,
    );
    return User ? ToReadModel(User) : null;
  },
};
