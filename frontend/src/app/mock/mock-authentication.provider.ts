import { MockAuthenticationProviderModel } from './mock-authentication.provider.model';
import { MockUser, MockUserCredential, MockUsers } from './mock-users';

const ToReadModel = ({ Password: _, Roles, ...User }: MockUserCredential): MockUser => ({
  ...User,
  Roles: [...Roles],
});

export const MockAuthenticationProvider: MockAuthenticationProviderModel = {
  IsEnabled: true,
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
