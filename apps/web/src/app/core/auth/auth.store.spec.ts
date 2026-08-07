import { AuthStore, AuthUser } from './auth.store';

const user: AuthUser = {
  sub: 'user-a',
  username: 'demo',
  email: 'demo@example.com',
  platformAdmin: false,
  memberships: []
};

describe('AuthStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores and clears access and refresh tokens', () => {
    const store = new AuthStore();

    store.login('access-token', 'refresh-token', user);

    expect(store.isAuthenticated()).toBeTrue();
    expect(localStorage.getItem('accessToken')).toBe('access-token');
    expect(localStorage.getItem('refreshToken')).toBe('refresh-token');

    store.logout();

    expect(store.isAuthenticated()).toBeFalse();
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });
});
