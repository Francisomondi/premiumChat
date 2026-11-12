
import { create } from "zustand";

import {
  registerUser,
  loginUser,
  getCurrentUser,
  logoutUser,
} from "../api/services/authService";

const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isInitialized: false,
  isLoading: false,
  error: null,

  initializeAuth: async () => {
    if (get().isInitialized) return;

    set({ isLoading: true, error: null });

    try {
      const response = await getCurrentUser();

      set({
        user: response.data.user,
        isAuthenticated: true,
        isInitialized: true,
        isLoading: false,
      });
    } catch {
      set({
        user: null,
        isAuthenticated: false,
        isInitialized: true,
        isLoading: false,
      });
    }
  },

  register: async (payload) => {
    set({ isLoading: true, error: null });

    try {
      const response = await registerUser(payload);

      set({
        user: response.data.user,
        isAuthenticated: true,
        isInitialized: true,
        isLoading: false,
      });

      return { success: true };
    } catch (error) {
      const message =
        error.response?.data?.message ||
        "Registration failed. Please try again.";

      set({ error: message, isLoading: false });

      return { success: false, message };
    }
  },

  login: async (payload) => {
    set({ isLoading: true, error: null });

    try {
      const response = await loginUser(payload);

      set({
        user: response.data.user,
        isAuthenticated: true,
        isInitialized: true,
        isLoading: false,
      });

      return { success: true };
    } catch (error) {
      const message =
        error.response?.data?.message ||
        "Login failed. Please check your details.";

      set({ error: message, isLoading: false });

      return { success: false, message };
    }
  },

  logout: async () => {
    set({ isLoading: true, error: null });

    try {
      await logoutUser();
    } catch (error) {
      // Keep the local session state intact if logout fails.
      set({
        error:
          error.response?.data?.message ||
          "Unable to log out. Please try again.",
        isLoading: false,
      });

      return { success: false };
    }

    set({
      user: null,
      isAuthenticated: false,
      isInitialized: true,
      isLoading: false,
      error: null,
    });

    return { success: true };
  },

  clearError: () => set({ error: null }),
}));

export default useAuthStore;
