import { MotionConfig, motionValue, useTransform } from 'framer-motion';
import { AbsoluteFill, Img, useCurrentFrame } from 'remotion';
import { Theme, themes, UserStats } from '../../config';
import { interpolateFactory } from '../../lib/utils';
import { fadeInAndSlideUp } from '../../lib/animations';
import { GeminiEffect } from '../effects/GeminiEffect';
import { WaveBackground } from '../effects/WaveBackground';
import { StatRow } from '../ui/StatRow';
import { cardSettings } from '../../settings';
import {
	StarIcon,
	ForkIcon,
	CommitIcon,
	PullRequestIcon,
	ContributionIcon,
	CodeIcon,
	ViewIcon,
	FireIcon,
} from '../icons';

type BackgroundEffect = 'gemini' | 'waves';

interface ReadmeCardProps {
	userStats: UserStats;
	theme?: Theme;
	backgroundEffect?: BackgroundEffect;
}

/**
 * Main README card with stats and choice of background effect
 */
export function ReadmeCard({ 
	userStats, 
	theme = 'dark', 
	backgroundEffect = 'gemini' 
}: ReadmeCardProps) {
	const frame = useCurrentFrame();
	const themeColors = themes[theme];

	// Gemini effect path animations (only used when backgroundEffect is 'gemini')
	const pathLengthFirst = useTransform(
		motionValue(interpolateFactory(frame, 0, 6, 0.8)),
		[0, 0.8],
		[0.2, 1.2]
	);
	const pathLengthSecond = useTransform(
		motionValue(interpolateFactory(frame, 0, 6, 0.8)),
		[0, 0.8],
		[0.15, 1.2]
	);
	const pathLengthThird = useTransform(
		motionValue(interpolateFactory(frame, 0, 6, 0.8)),
		[0, 0.8],
		[0.1, 1.2]
	);
	const pathLengthFourth = useTransform(
		motionValue(interpolateFactory(frame, 0, 6, 0.8)),
		[0, 0.8],
		[0.05, 1.2]
	);
	const pathLengthFifth = useTransform(
		motionValue(interpolateFactory(frame, 0, 6, 0.8)),
		[0, 0.8],
		[0, 1.2]
	);

	const stats = [
		{ icon: <StarIcon size={32} />, label: 'Stars', value: userStats.starCount },
		{ icon: <ForkIcon size={32} />, label: 'Forks', value: userStats.forkCount },
		{ icon: <CommitIcon size={32} />, label: 'Commits', value: userStats.totalCommits },
		{ icon: <PullRequestIcon size={32} />, label: 'Pull Requests', value: userStats.totalPullRequests },
	];

	// Add followers if available
	if (userStats.followers !== undefined) {
		stats.push({
			icon: <ContributionIcon size={32} />, // Using ContributionIcon as placeholder for followers
			label: 'Followers',
			value: userStats.followers,
		});
	}

	// Add pull request reviews if available
	if (userStats.totalPullRequestReviews !== undefined && userStats.totalPullRequestReviews > 0) {
		stats.push({
			icon: <PullRequestIcon size={32} />,
			label: 'PR Reviews',
			value: userStats.totalPullRequestReviews,
		});
	}

	// Add repo views
	stats.push({
		icon: <ViewIcon size={32} />,
		label: 'Repo Views',
		value: userStats.repoViews,
	});

	// Add lines added and deleted if available
	if (userStats.linesAdded !== undefined && userStats.linesAdded > 0) {
		stats.push({
			icon: <CodeIcon size={32} />,
			label: 'Lines Added',
			value: userStats.linesAdded,
			format: 'short' as const,
		});
	}

	if (userStats.linesDeleted !== undefined && userStats.linesDeleted > 0) {
		stats.push({
			icon: <CodeIcon size={32} />,
			label: 'Lines Deleted',
			value: userStats.linesDeleted,
			format: 'short' as const,
		});
	}

	// Add lines changed (fallback if added/deleted not available)
	if ((userStats.linesAdded === undefined || userStats.linesAdded === 0) && 
	    (userStats.linesDeleted === undefined || userStats.linesDeleted === 0) &&
	    userStats.linesOfCodeChanged > 0) {
		stats.push({
			icon: <CodeIcon size={32} />,
			label: 'Lines Changed',
			value: userStats.linesOfCodeChanged,
			format: 'short' as const,
		});
	}

	// Add issues if available
	const totalIssues = (userStats.openIssues || 0) + (userStats.closedIssues || 0);
	if (totalIssues > 0) {
		stats.push({
			icon: <ContributionIcon size={32} />, // Using ContributionIcon as placeholder for issues
			label: 'Issues',
			value: totalIssues,
		});
	}

	// Add contributions
	stats.push({
		icon: <ContributionIcon size={32} />,
		label: 'Contributions',
		value: userStats.totalContributions,
	});

	// Add streak if available
	if (userStats.contributionStats?.currentStreak) {
		stats.push({
			icon: <FireIcon size={32} />,
			label: 'Current Streak',
			value: userStats.contributionStats.currentStreak,
		});
	}

	const headerAnimation = fadeInAndSlideUp(frame, 0);
	const bgOpacity = theme === 'dark' ? cardSettings.bgOpacityDark : cardSettings.bgOpacityLight;

	return (
		<AbsoluteFill style={{ backgroundColor: theme === 'dark' ? '#0d1117' : '#ffffff' }}>
			<div
				style={{
					width: '100%',
					height: '100%',
					padding: cardSettings.outerPadding,
					fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
				}}
			>
				<div
					style={{
						width: '100%',
						height: '100%',
						backgroundColor: theme === 'dark' 
							? `rgba(22, 27, 34, ${bgOpacity})`
							: `rgba(255, 255, 255, ${bgOpacity})`,
						borderRadius: cardSettings.borderRadius,
						padding: cardSettings.padding,
						position: 'relative',
						overflow: 'hidden',
						border: `1px solid ${theme === 'dark' ? 'rgba(48, 54, 61, 0.3)' : 'rgba(208, 215, 222, 0.3)'}`,
						backdropFilter: `blur(${cardSettings.backdropBlur}px)`,
					}}
				>
					{/* Background Effect */}
					{backgroundEffect === 'gemini' ? (
						<div
							style={{
								position: 'absolute',
								left: 0,
								right: 0,
								bottom: 0,
								top: 0,
								transform: 'rotate(-105deg) scale(1.3)',
								pointerEvents: 'none',
							}}
						>
							{/* Ensure Framer Motion animations run in headless renders (avoid reduced-motion behavior). */}
							<MotionConfig reducedMotion="never">
								<GeminiEffect
									pathLengths={[
										pathLengthFirst,
										pathLengthSecond,
										pathLengthThird,
										pathLengthFourth,
										pathLengthFifth,
									]}
									theme={theme}
									opacity={theme === 'dark' ? 0.5 : 0.35}
								/>
							</MotionConfig>
						</div>
					) : (
						<WaveBackground theme={theme} />
					)}

					{/* Header */}
					<div
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: 24,
							marginBottom: 28,
							position: 'relative',
							zIndex: 1,
							...headerAnimation,
						}}
					>
						<Img
							src={userStats.avatarUrl}
							style={{
								width: 88,
								height: 88,
								borderRadius: '50%',
								border: `4px solid ${themeColors.border}`,
							}}
						/>
						<div
							style={{
								fontSize: 32,
								fontWeight: 600,
								color: themeColors.text,
							}}
						>
							{userStats.name || userStats.username}
						</div>
					</div>

					{/* Stats Grid */}
					<div
						style={{
							display: 'flex',
							flexDirection: 'column',
							gap: 12,
							position: 'relative',
							zIndex: 1,
						}}
					>
						{stats.map((stat, i) => (
							<StatRow
								key={stat.label}
								icon={stat.icon}
								label={stat.label}
								value={stat.value}
								index={i}
								theme={theme}
								staggerDelay={4}
								format={(stat as { format?: 'commas' | 'short' | 'none' }).format || 'commas'}
							/>
						))}
					</div>
				</div>
			</div>
		</AbsoluteFill>
	);
}
