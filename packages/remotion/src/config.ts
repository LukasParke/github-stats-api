import { z } from "zod";

// Optimized settings for smaller GIF file size
export const FPS = 50;
export const DurationInSeconds = 8;
export const DurationInFrames = FPS * DurationInSeconds;

export const Config = {
  FPS,
  DurationInSeconds,
  DurationInFrames,
};

// Theme types
export type Theme = "light" | "dark";

export const themes = {
  light: {
    background: "transparent",
    text: "#24292f",
    textMuted: "#57606a",
    accent: "#0969da",
    border: "#d0d7de",
    cardBg: "rgba(255, 255, 255, 0.85)",
    geminiColors: ["#FFB7C5", "#FFDDB7", "#B1C5FF", "#4FABFF", "#076EFF"],
  },
  dark: {
    background: "transparent",
    text: "#f0f6fc",
    textMuted: "#8b949e",
    accent: "#58a6ff",
    border: "#30363d",
    cardBg: "rgba(22, 27, 34, 0.85)",
    geminiColors: ["#FFB7C5", "#FFDDB7", "#B1C5FF", "#4FABFF", "#076EFF"],
  },
} as const;

// Zod schemas
const ContributionDay = z.object({
  contributionCount: z.number(),
  date: z.string(),
});

const Week = z.object({
  contributionDays: z.array(ContributionDay),
});

const ContributionCalendar = z.object({
  totalContributions: z.number(),
  weeks: z.array(Week),
});

const ContributionsCollection = z.object({
  totalCommitContributions: z.number(),
  restrictedContributionsCount: z.number(),
  totalIssueContributions: z.number(),
  totalRepositoryContributions: z.number(),
  totalPullRequestContributions: z.number(),
  totalPullRequestReviewContributions: z.number(),
  contributionCalendar: ContributionCalendar,
});

const ContributionStats = z.object({
  longestStreak: z.number(),
  currentStreak: z.number(),
  mostActiveDay: z.string(),
  averagePerDay: z.number(),
  averagePerWeek: z.number(),
  averagePerMonth: z.number(),
  monthlyBreakdown: z.array(
    z.object({
      month: z.string(),
      contributions: z.number(),
    })
  ),
});

const TopLanguage = z.object({
  languageName: z.string(),
  color: z.string().nullable(),
  value: z.number(),
  percentage: z.number().optional(),
});

export const userStatsSchema = z.object({
  name: z.string(),
  avatarUrl: z.string(),
  username: z.string(),
  bio: z.string().optional(),
  company: z.string().optional(),
  location: z.string().optional(),
  email: z.string().optional(),
  websiteUrl: z.string().optional(),
  createdAt: z.string().optional(),
  repoViews: z.number(),
  linesOfCodeChanged: z.number(),
  linesAdded: z.number(),
  linesDeleted: z.number(),
  linesChanged: z.number().optional(),
  commitCount: z.number().optional(),
  totalCommits: z.number(),
  totalPullRequests: z.number(),
  totalPullRequestReviews: z.number().optional(),
  openIssues: z.number().optional(),
  closedIssues: z.number().optional(),
  fetchedAt: z.number().optional(),
  forkCount: z.number(),
  starCount: z.number(),
  starsGiven: z.number().optional(),
  followers: z.number().optional(),
  following: z.number().optional(),
  repositoriesContributedTo: z.number().optional(),
  discussionsStarted: z.number().optional(),
  discussionsAnswered: z.number().optional(),
  totalContributions: z.number(),
  codeByteTotal: z.number(),
  topLanguages: z.array(TopLanguage),
  contributionStats: ContributionStats.optional(),
  contributionsCollection: ContributionsCollection.optional(),
  contributionCalendar: z.array(ContributionDay).optional(),
});

export const musicDataSchema = z.object({
  trackName: z.string(),
  artistName: z.string(),
  albumName: z.string().optional(),
  albumArtUrl: z.string().optional(),
  audioSrc: z.string().optional(),
  isPlaying: z.boolean().optional(),
});

export const mainSchema = z.object({
  userStats: userStatsSchema,
  theme: z.enum(["light", "dark"]).default("dark"),
  musicData: musicDataSchema.optional(),
});

export type MainProps = z.infer<typeof mainSchema>;
export type UserStats = z.infer<typeof userStatsSchema>;
export type MusicData = z.infer<typeof musicDataSchema>;
export type ContributionDayType = z.infer<typeof ContributionDay>;
export type TopLanguageType = z.infer<typeof TopLanguage>;
