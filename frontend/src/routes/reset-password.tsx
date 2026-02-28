import { createFileRoute, redirect } from "@tanstack/react-router"

import { isLoggedIn } from "@/hooks/useAuth"

type ResetPasswordSearch = {
  token: string
}

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search): ResetPasswordSearch => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  beforeLoad: async ({ search }) => {
    if (isLoggedIn()) {
      throw redirect({ to: "/" })
    }
    if (!search.token) {
      throw redirect({ to: "/login" })
    }
  },
  head: () => ({
    meta: [
      {
        title: "Reset Password - FastAPI Cloud",
      },
    ],
  }),
})
