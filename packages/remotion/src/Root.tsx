import '@fontsource/inter/latin.css';
import { AbsoluteFill, CalculateMetadataFunction, Composition, getInputProps } from 'remotion';
import './styles/global.css';

import { getUserStats } from './data/fetchers';
import { Config, mainSchema, MainProps, Theme } from './config';
import { defaultStats, defaultMusicData } from './data/defaultStats';
import { ReadmeCard } from './components/cards/ReadmeCard';
import { CommitStreakCard } from './components/cards/CommitStreakCard';
import { TopLanguagesCard } from './components/cards/TopLanguagesCard';
import { ContributionCard } from './components/cards/ContributionCard';
import { CommitGraphCard } from './components/cards/CommitGraphCard';

const { FPS, DurationInFrames } = Config;

type BackgroundEffect = 'gemini' | 'waves';
type AnimationStyle = 'wave' | 'rain' | 'cascade';

// Composition configurations
const compositions: Array<{
	id: string;
	component: typeof ReadmeCard | typeof CommitStreakCard | typeof TopLanguagesCard | typeof ContributionCard | typeof CommitGraphCard;
	width: number;
	height: number;
	theme: Theme;
	backgroundEffect?: BackgroundEffect;
	animationStyle?: AnimationStyle;
	includeMusic?: boolean;
}> = [
	// =========================================================================
	// Main README Cards - 4 variants: light/dark + gemini/waves
	// =========================================================================
	{
		id: 'readme-dark-gemini',
		component: ReadmeCard,
		width: 900,
		height: 800,
		theme: 'dark',
		backgroundEffect: 'gemini',
	},
	{
		id: 'readme-light-gemini',
		component: ReadmeCard,
		width: 900,
		height: 800,
		theme: 'light',
		backgroundEffect: 'gemini',
	},
	{
		id: 'readme-dark-waves',
		component: ReadmeCard,
		width: 900,
		height: 800,
		theme: 'dark',
		backgroundEffect: 'waves',
	},
	{
		id: 'readme-light-waves',
		component: ReadmeCard,
		width: 900,
		height: 800,
		theme: 'light',
		backgroundEffect: 'waves',
	},

	// =========================================================================
	// Commit Streak Cards
	// =========================================================================
	{
		id: 'commit-streak-dark',
		component: CommitStreakCard,
		width: 900,
		height: 460,
		theme: 'dark',
	},
	{
		id: 'commit-streak-light',
		component: CommitStreakCard,
		width: 900,
		height: 460,
		theme: 'light',
	},

	// =========================================================================
	// Top Languages Cards
	// =========================================================================
	{
		id: 'top-languages-dark',
		component: TopLanguagesCard,
		width: 900,
		height: 620,
		theme: 'dark',
	},
	{
		id: 'top-languages-light',
		component: TopLanguagesCard,
		width: 900,
		height: 620,
		theme: 'light',
	},

	// =========================================================================
	// Contribution Activity Cards
	// =========================================================================
	{
		id: 'contribution-dark',
		component: ContributionCard,
		width: 900,
		height: 280,
		theme: 'dark',
	},
	{
		id: 'contribution-light',
		component: ContributionCard,
		width: 900,
		height: 280,
		theme: 'light',
	},

	// =========================================================================
	// Commit Graph Cards - 3 animation styles x 2 themes
	// =========================================================================
	// Wave animation
	{
		id: 'commit-graph-dark-wave',
		component: CommitGraphCard,
		width: 900,
		height: 380,
		theme: 'dark',
		animationStyle: 'wave',
	},
	{
		id: 'commit-graph-light-wave',
		component: CommitGraphCard,
		width: 900,
		height: 380,
		theme: 'light',
		animationStyle: 'wave',
	},
	// Rain animation
	{
		id: 'commit-graph-dark-rain',
		component: CommitGraphCard,
		width: 900,
		height: 380,
		theme: 'dark',
		animationStyle: 'rain',
	},
	{
		id: 'commit-graph-light-rain',
		component: CommitGraphCard,
		width: 900,
		height: 380,
		theme: 'light',
		animationStyle: 'rain',
	},
	// Cascade animation
	{
		id: 'commit-graph-dark-cascade',
		component: CommitGraphCard,
		width: 900,
		height: 380,
		theme: 'dark',
		animationStyle: 'cascade',
	},
	{
		id: 'commit-graph-light-cascade',
		component: CommitGraphCard,
		width: 900,
		height: 380,
		theme: 'light',
		animationStyle: 'cascade',
	},
];

export const RemotionRoot = () => {
	const calculateMetadata: CalculateMetadataFunction<MainProps> = async ({
		props,
		abortSignal,
	}) => {
		// If the caller provided userStats via inputProps (server render), trust it.
		// This keeps renders deterministic and prevents Studio-vs-server divergence.
		const inputProps = getInputProps() as Partial<MainProps> & {
			usernames?: string[];
		};

		if (inputProps.userStats) {
			return {
				props: {
					...props,
					userStats: inputProps.userStats,
				},
			};
		}

		const usernames = inputProps.usernames;
		let userStats = defaultStats;

		// Studio fallback: fetch stats for preview if userStats was not explicitly provided.
		try {
			userStats = await getUserStats(usernames, abortSignal);
		} catch (error) {
			console.error('Failed to fetch user stats, using defaults:', error);
		}

		return {
			props: {
				...props,
				userStats,
			},
		};
	};

	return (
		<>
			{compositions.map(({ id, component: Component, width, height, theme, backgroundEffect, animationStyle, includeMusic }) => (
				<Composition
					key={id}
					id={id}
					component={(props: MainProps) => (
						<AbsoluteFill
							style={{
								// Always use GitHub background colors for seamless display in READMEs
								backgroundColor: theme === 'dark' ? '#0d1117' : '#ffffff',
							}}
						>
							<Component
								userStats={props.userStats}
								theme={theme}
								{...(backgroundEffect && { backgroundEffect })}
								{...(animationStyle && { animationStyle })}
								{...(includeMusic && { musicData: defaultMusicData })}
							/>
						</AbsoluteFill>
					)}
					durationInFrames={DurationInFrames}
					fps={FPS}
					width={width}
					height={height}
					schema={mainSchema}
					calculateMetadata={calculateMetadata}
					defaultProps={{
						userStats: defaultStats,
						theme,
						...(includeMusic && { musicData: defaultMusicData }),
					}}
				/>
			))}
		</>
	);
};
