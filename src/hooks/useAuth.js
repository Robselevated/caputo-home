const FIXED_USER = { id: '6b119624-4a49-4840-85da-8ae7fcc221dd' }
const FIXED_PROFILE = {
  id: '6b119624-4a49-4840-85da-8ae7fcc221dd',
  household_id: 'a99a65ef-09ef-44a6-a214-0a10f8b87b99',
  name: 'Caputo Family',
}

export function useAuth() {
  return {
    user: FIXED_USER,
    profile: FIXED_PROFILE,
    loading: false,
    signIn: async () => ({ error: null }),
    signOut: async () => {},
  }
}
