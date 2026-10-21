import { getSettings } from "./settings";

// Reward eligibility, shared by Rankings, Performance Tracking and Reports.
// Admins set the number of placement awards and the High Performer
// threshold on the Settings page.
const PLACEMENTS = ["Overall Champion", "First Runner-Up", "Second Runner-Up"];

export function rewardFor(rank: number, totalPoints: number) {
  const { placement_awards, high_performer_points } = getSettings();

  if (totalPoints > 0 && rank >= 1 && rank <= Math.min(placement_awards, PLACEMENTS.length)) {
    return PLACEMENTS[rank - 1];
  }
  if (totalPoints >= high_performer_points) return "High Performer";
  if (totalPoints > 0) return "Active Participant";
  return "Not yet eligible";
}
