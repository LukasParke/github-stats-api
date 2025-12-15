import { UserStats, MusicData } from '../config';
import { statsSettings } from '../settings';

const statsTemplate = (username: string) =>
	`https://raw.githubusercontent.com/${username}/stats/main/github-user-stats.json`;

/**
 * Fetch stats from a direct URL
 */
export async function getStatsFromUrl(
	url: string,
	signal?: AbortSignal
): Promise<UserStats> {
	const resp = await fetch(url, signal ? { signal } : undefined);
	if (!resp.ok) {
		throw new Error(`Failed to fetch stats from ${url}: ${resp.status}`);
	}
	return resp.json();
}

/**
 * Fetch stats for multiple GitHub users and merge them
 */
export async function getUsersStatsFromGithub(
	usernames: string[],
	signal?: AbortSignal
): Promise<UserStats[]> {
	const stats: UserStats[] = [];

	for (const username of usernames) {
		try {
			const resp = await fetch(
				statsTemplate(username),
				signal ? { signal } : undefined
			);
			if (resp.ok) {
				const userStats = await resp.json();
				stats.push(userStats);
			}
		} catch (error) {
			console.error(`Failed to fetch stats for ${username}:`, error);
		}
	}

	return stats;
}

/**
 * Merge stats from multiple accounts into one
 */
export function mergeUsersStats(stats: UserStats[]): UserStats {
	if (stats.length === 0) {
		throw new Error('No stats to merge');
	}

	const userStats = { ...stats[0] };

	for (const stat of stats.slice(1)) {
		userStats.starCount += stat.starCount;
		userStats.forkCount += stat.forkCount;
		userStats.totalCommits += stat.totalCommits;
		userStats.totalPullRequests += stat.totalPullRequests;
		userStats.totalContributions += stat.totalContributions;
		userStats.repoViews += stat.repoViews;
		userStats.linesOfCodeChanged += stat.linesOfCodeChanged;
		userStats.linesAdded += stat.linesAdded;
		userStats.linesDeleted += stat.linesDeleted;
		userStats.codeByteTotal += stat.codeByteTotal;

		if (stat.openIssues) {
			userStats.openIssues = (userStats.openIssues || 0) + stat.openIssues;
		}
		if (stat.closedIssues) {
			userStats.closedIssues = (userStats.closedIssues || 0) + stat.closedIssues;
		}

		// Merge top languages
		userStats.topLanguages = [...userStats.topLanguages, ...stat.topLanguages];
	}

	// Sort and merge duplicate languages
	return sortAndMergeTopLanguages(userStats);
}

/**
 * Sort and merge duplicate languages in top languages list
 */
function sortAndMergeTopLanguages(userStats: UserStats): UserStats {
	const languageMap = new Map<string, { color: string | null; value: number }>();

	for (const lang of userStats.topLanguages) {
		const existing = languageMap.get(lang.languageName);
		if (existing) {
			existing.value += lang.value;
		} else {
			languageMap.set(lang.languageName, {
				color: lang.color,
				value: lang.value,
			});
		}
	}

	const mergedLanguages = Array.from(languageMap.entries())
		.map(([languageName, { color, value }]) => ({
			languageName,
			color,
			value,
		}))
		.sort((a, b) => b.value - a.value);

	userStats.topLanguages = mergedLanguages;
	return userStats;
}

/**
 * Main function to get user stats
 * Uses direct URL from settings if available, otherwise fetches by usernames
 */
export async function getUserStats(
	usernames?: string[],
	signal?: AbortSignal
): Promise<UserStats> {
	// If a direct stats URL is configured, use that
	if (statsSettings.statsUrl) {
		return getStatsFromUrl(statsSettings.statsUrl, signal);
	}
	
	// Otherwise, fetch by usernames
	const names = usernames || statsSettings.usernames;
	const stats = await getUsersStatsFromGithub(names, signal);
	return mergeUsersStats(stats);
}

/**
 * Fetch music data from Spotify API or static JSON
 * This is a placeholder - implement actual Spotify/Last.fm integration as needed
 */
export async function getMusicData(source?: string): Promise<MusicData | null> {
	// If a static source URL is provided, fetch from there
	if (source) {
		try {
			const resp = await fetch(source);
			if (resp.ok) {
				return await resp.json();
			}
		} catch (error) {
			console.error('Failed to fetch music data:', error);
		}
	}

	// Return default/mock music data for development
	return {
		trackName: 'Favorite Song',
		artistName: 'Artist Name',
		albumName: 'Album',
		isPlaying: true,
	};
}

