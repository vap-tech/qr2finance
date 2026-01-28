// hooks/useUser.js
import { useState } from "react";

export const useUser = () => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const saveUser = (userData) => {
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
  };

  const clearUser = () => {
    localStorage.removeItem("user");
    setUser(null);
  };

  const updateUser = (updates) => {
    const updatedUser = { ...user, ...updates };
    saveUser(updatedUser);
  };

  return {
    user,
    saveUser,
    clearUser,
    updateUser,
    isAuthenticated: !!user,
  };
};
