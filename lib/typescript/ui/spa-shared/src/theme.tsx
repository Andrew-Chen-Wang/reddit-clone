"use client"

import * as React from "react"

export type Theme = "light" | "dark" | "system"
export type ResolvedTheme = "light" | "dark"

export const THEME_STORAGE_KEY = "readit-theme"
export const THEME_COOKIE_NAME = "readit-theme"

type ThemeContextValue = {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null)

function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system"
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function readStoredTheme(storageKey: string, cookieName: string): Theme | null {
  if (typeof window === "undefined") return null
  try {
    const fromStorage = window.localStorage.getItem(storageKey)
    if (isTheme(fromStorage)) return fromStorage
  } catch {}
  const match = new RegExp("(?:^|; )" + cookieName + "=([^;]*)").exec(document.cookie)
  const fromCookie = match ? decodeURIComponent(match[1]) : null
  return isTheme(fromCookie) ? fromCookie : null
}

function applyResolvedTheme(resolved: ResolvedTheme) {
  const root = document.documentElement
  root.classList.toggle("dark", resolved === "dark")
  root.style.colorScheme = resolved
}

export type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
  cookieName?: string
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = THEME_STORAGE_KEY,
  cookieName = THEME_COOKIE_NAME,
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(
    () => readStoredTheme(storageKey, cookieName) ?? defaultTheme,
  )
  const [systemTheme, setSystemTheme] = React.useState<ResolvedTheme>(getSystemTheme)

  React.useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => {
      setSystemTheme(mql.matches ? "dark" : "light")
    }
    onChange()
    mql.addEventListener("change", onChange)
    return () => {
      mql.removeEventListener("change", onChange)
    }
  }, [])

  const resolvedTheme: ResolvedTheme = theme === "system" ? systemTheme : theme

  React.useEffect(() => {
    applyResolvedTheme(resolvedTheme)
  }, [resolvedTheme])

  const setTheme = React.useCallback(
    (next: Theme) => {
      setThemeState(next)
      try {
        window.localStorage.setItem(storageKey, next)
      } catch {}
      document.cookie = `${cookieName}=${next}; path=/; max-age=31536000; SameSite=Lax`
    },
    [storageKey, cookieName],
  )

  const value = React.useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = React.useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}

export function getThemeInitScript(
  storageKey: string = THEME_STORAGE_KEY,
  cookieName: string = THEME_COOKIE_NAME,
): string {
  return `(function(){try{var k=${JSON.stringify(storageKey)};var c=${JSON.stringify(cookieName)};var t=null;try{t=localStorage.getItem(k)}catch(e){}if(t!=="light"&&t!=="dark"&&t!=="system"){var m=document.cookie.match(new RegExp("(?:^|; )"+c+"=([^;]*)"));t=m?decodeURIComponent(m[1]):null}if(t!=="light"&&t!=="dark"&&t!=="system"){t="system"}var d=t==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):t;var r=document.documentElement;if(d==="dark"){r.classList.add("dark")}else{r.classList.remove("dark")}r.style.colorScheme=d}catch(e){}})();`
}

export const themeInitScript = getThemeInitScript()
