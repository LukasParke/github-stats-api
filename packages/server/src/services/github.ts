import { App } from "@octokit/app";
import { Octokit } from "@octokit/core";
import { env } from "../config/env";

// User stats type (mirrors the Remotion config type)
export interface UserStats {
  username: string;
  name: string;
  avatarUrl: string;
  bio?: string;
  company?: string;
  location?: string;
  email?: string;
  websiteUrl?: string;
  createdAt?: string;
  followers?: number;
  following?: number;
  starCount: number;
  forkCount: number;
  totalCommits: number;
  totalPullRequests: number;
  totalPullRequestReviews?: number;
  totalContributions: number;
  repoViews: number;
  linesOfCodeChanged: number;
  linesAdded: number;
  linesDeleted: number;
  codeByteTotal: number;
  topLanguages: Array<{
    languageName: string;
    color: string | null;
    value: number;
  }>;
  contributionStats?: {
    currentStreak: number;
    longestStreak: number;
    mostActiveDay: string;
    averagePerDay: number;
    averagePerWeek: number;
    averagePerMonth: number;
    monthlyBreakdown: Array<{ month: string; contributions: number }>;
  };
  contributionsCollection?: {
    totalCommitContributions: number;
    restrictedContributionsCount: number;
    totalIssueContributions: number;
    totalRepositoryContributions: number;
    totalPullRequestContributions: number;
    totalPullRequestReviewContributions: number;
    contributionCalendar: {
      totalContributions: number;
      weeks: Array<{
        contributionDays: Array<{
          contributionCount: number;
          date: string;
        }>;
      }>;
    };
  };
}

// Initialize GitHub App
const app = new App({
  appId: env.GITHUB_APP_ID,
  privateKey: env.GITHUB_APP_PRIVATE_KEY,
});

// GraphQL query for user stats
const USER_STATS_QUERY = `
  query($login: String!) {
    user(login: $login) {
      login
      name
      avatarUrl
      bio
      company
      location
      email
      websiteUrl
      createdAt
      followers {
        totalCount
      }
      following {
        totalCount
      }
      repositories(first: 100, ownerAffiliations: OWNER, isFork: false) {
        totalCount
        nodes {
          stargazerCount
          forkCount
          languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
            edges {
              size
              node {
                name
                color
              }
            }
          }
        }
      }
      contributionsCollection {
        totalCommitContributions
        restrictedContributionsCount
        totalIssueContributions
        totalRepositoryContributions
        totalPullRequestContributions
        totalPullRequestReviewContributions
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              contributionCount
              date
            }
          }
        }
      }
    }
  }
`;

/**
 * Get an authenticated Octokit instance for an installation
 */
export async function getInstallationOctokit(
  installationId: number
): Promise<Octokit> {
  return await app.getInstallationOctokit(installationId);
}

/**
 * Lightweight check that GitHub is reachable and the App credentials are valid.
 * Uses app-level authentication (JWT) and hits the public GitHub API.
 */
export async function checkGitHubAppAuth(): Promise<void> {
  // This endpoint returns metadata about the authenticated GitHub App.
  // If credentials are invalid, this will fail with 401/403.
  await app.octokit.request("GET /app");
}

/**
 * Fetch user stats using the GitHub GraphQL API
 */
export async function fetchUserStats(
  installationId: number | undefined,
  username: string
): Promise<UserStats> {
  let octokit: Octokit;

  if (installationId) {
    octokit = await getInstallationOctokit(installationId);
  } else {
    // Fallback to unauthenticated (limited rate) - for public data only
    octokit = new Octokit();
  }

  const response = await octokit.graphql<{ user: GitHubUser }>(
    USER_STATS_QUERY,
    {
      login: username,
    }
  );

  const user = response.user;
  if (!user) {
    throw new Error(`User not found: ${username}`);
  }

  // Calculate aggregated stats
  let totalStars = 0;
  let totalForks = 0;
  const languageMap = new Map<string, { size: number; color: string | null }>();

  for (const repo of user.repositories.nodes) {
    totalStars += repo.stargazerCount;
    totalForks += repo.forkCount;

    for (const edge of repo.languages.edges) {
      const lang = languageMap.get(edge.node.name);
      if (lang) {
        lang.size += edge.size;
      } else {
        languageMap.set(edge.node.name, {
          size: edge.size,
          color: edge.node.color,
        });
      }
    }
  }

  // Sort languages by size and convert to array
  const topLanguages = Array.from(languageMap.entries())
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 10)
    .map(([name, { size, color }]) => ({
      languageName: name,
      color,
      value: size,
    }));

  // Calculate contribution stats
  const calendar = user.contributionsCollection.contributionCalendar;
  const allDays = calendar.weeks.flatMap((w: Week) => w.contributionDays);

  const { currentStreak, longestStreak } = calculateStreaks(allDays);
  const contributionsByDay = allDays.reduce(
    (acc: Record<string, number>, day: ContributionDay) => {
      const dayOfWeek = new Date(day.date).toLocaleDateString("en-US", {
        weekday: "long",
      });
      acc[dayOfWeek] = (acc[dayOfWeek] || 0) + day.contributionCount;
      return acc;
    },
    {} as Record<string, number>
  );

  const mostActiveDay =
    Object.entries(contributionsByDay).sort((a, b) => b[1] - a[1])[0]?.[0] ||
    "Monday";

  const contributions = user.contributionsCollection;

  return {
    username: user.login,
    name: user.name || user.login,
    avatarUrl: user.avatarUrl,
    bio: user.bio || undefined,
    company: user.company || undefined,
    location: user.location || undefined,
    email: user.email || undefined,
    websiteUrl: user.websiteUrl || undefined,
    createdAt: user.createdAt,
    followers: user.followers.totalCount,
    following: user.following.totalCount,
    starCount: totalStars,
    forkCount: totalForks,
    totalCommits: contributions.totalCommitContributions,
    totalPullRequests: contributions.totalPullRequestContributions,
    totalPullRequestReviews: contributions.totalPullRequestReviewContributions,
    totalContributions: calendar.totalContributions,
    // These values come from external stats repo (not available via GitHub API)
    // They should be preserved if already present in userStats, otherwise default to 0
    repoViews: 0, // Not available via API - requires external stats source
    linesOfCodeChanged: 0, // Not available via API - requires external stats source
    linesAdded: 0, // Not available via API - requires external stats source
    linesDeleted: 0, // Not available via API - requires external stats source
    codeByteTotal: topLanguages.reduce((sum, lang) => sum + lang.value, 0),
    topLanguages,
    contributionStats: {
      currentStreak,
      longestStreak,
      mostActiveDay,
      averagePerDay: Math.round(calendar.totalContributions / 365),
      averagePerWeek: Math.round(calendar.totalContributions / 52),
      averagePerMonth: Math.round(calendar.totalContributions / 12),
      monthlyBreakdown: [], // Could be calculated from weeks
    },
    contributionsCollection: {
      totalCommitContributions: contributions.totalCommitContributions,
      restrictedContributionsCount: contributions.restrictedContributionsCount,
      totalIssueContributions: contributions.totalIssueContributions,
      totalRepositoryContributions: contributions.totalRepositoryContributions,
      totalPullRequestContributions:
        contributions.totalPullRequestContributions,
      totalPullRequestReviewContributions:
        contributions.totalPullRequestReviewContributions,
      contributionCalendar: {
        totalContributions: calendar.totalContributions,
        weeks: calendar.weeks,
      },
    },
  };
}

interface ContributionDay {
  contributionCount: number;
  date: string;
}

interface Week {
  contributionDays: ContributionDay[];
}

/**
 * Calculate current and longest contribution streaks
 */
function calculateStreaks(days: ContributionDay[]): {
  currentStreak: number;
  longestStreak: number;
} {
  // Sort by date descending (most recent first)
  const sortedDays = [...days].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  // Calculate current streak (from today backwards)
  for (const day of sortedDays) {
    if (day.contributionCount > 0) {
      currentStreak++;
    } else {
      break;
    }
  }

  // Calculate longest streak
  for (const day of sortedDays) {
    if (day.contributionCount > 0) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
  }

  return { currentStreak, longestStreak };
}

/**
 * Get the username associated with an installation
 */
export async function getInstallationUser(
  installationId: number
): Promise<string | null> {
  try {
    const octokit = await getInstallationOctokit(installationId);
    const response = await octokit.request(
      "GET /app/installations/{installation_id}",
      {
        installation_id: installationId,
      }
    );

    const account = response.data.account;
    if (account && "login" in account) {
      return account.login;
    }
    return null;
  } catch (error) {
    console.error("Failed to get installation user:", error);
    return null;
  }
}

// Types for GraphQL response
interface GitHubUser {
  login: string;
  name: string | null;
  avatarUrl: string;
  bio: string | null;
  company: string | null;
  location: string | null;
  email: string | null;
  websiteUrl: string | null;
  createdAt: string;
  followers: { totalCount: number };
  following: { totalCount: number };
  repositories: {
    totalCount: number;
    nodes: Array<{
      stargazerCount: number;
      forkCount: number;
      languages: {
        edges: Array<{
          size: number;
          node: {
            name: string;
            color: string | null;
          };
        }>;
      };
    }>;
  };
  contributionsCollection: {
    totalCommitContributions: number;
    restrictedContributionsCount: number;
    totalIssueContributions: number;
    totalRepositoryContributions: number;
    totalPullRequestContributions: number;
    totalPullRequestReviewContributions: number;
    contributionCalendar: {
      totalContributions: number;
      weeks: Week[];
    };
  };
}

export { app };
