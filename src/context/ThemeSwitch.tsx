"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { FaSun, FaMoon, FaDesktop } from "react-icons/fa";

const themes = [
  { id: "system", icon: FaDesktop },
  { id: "light", icon: FaSun },
  { id: "dark", icon: FaMoon },
] as const;

export default function ThemeSwitch() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const currentIndex = themes.findIndex((t) => t.id === theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex].id);
  };

  if (!mounted) {
    return (
      <button
        className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors duration-200"
        aria-label="Theme settings"
      >
        <span className="opacity-0">Loading...</span>
      </button>
    );
  }

  const currentTheme = themes.find((t) => t.id === theme) || themes[0];
  const CurrentIcon = currentTheme.icon;

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center justify-center rounded-lg text-gray-700 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 transition-colors duration-200"
      aria-label="Toggle theme"
      title={`Current theme: ${currentTheme.id}`}
    >
      <CurrentIcon className="w-4 h-4 flex-shrink-0" />
    </button>
  );
}
