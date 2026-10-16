import type { Contest } from "@/db/schema";

export function participationLabel(c: Pick<Contest, "participation" | "newRating">): string {
  switch (c.participation) {
    case "contest":
      return c.newRating != null ? "Rated" : "Live";
    case "unofficial":
      return "Unofficial";
    case "virtual":
      return "Virtual";
    case "practice":
      return "Practice only";
  }
}

export function ratingDelta(c: Pick<Contest, "oldRating" | "newRating">): number | null {
  return c.oldRating != null && c.newRating != null ? c.newRating - c.oldRating : null;
}
