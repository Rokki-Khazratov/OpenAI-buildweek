import { apiFetch } from "@/lib/api/browser";

export type CurrentUserDto = {
  id: string;
  email: string;
  display_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export function getCurrentUser() {
  return apiFetch<CurrentUserDto>("/me");
}

export function updateCurrentUser(displayName: string) {
  return apiFetch<CurrentUserDto>("/me", {
    method: "PATCH",
    body: JSON.stringify({ display_name: displayName }),
  });
}
