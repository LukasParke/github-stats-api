import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Theme, themes, UserStats } from '../../config';
import { StreakRing } from '../ui/StreakRing';
import { AnimatedCounter } from '../effects/AnimatedCounter';
import { AuroraEffect } from '../effects/AuroraEffect';
import { fadeInAndSlideUp } from '../../lib/animations';
import { FireIcon } from '../icons';
import { cardSettings } from '../../settings';

interface CommitStreakCardProps {
	userStats: UserStats;
	theme?: Theme;
}

/**
 * Card showing current and longest commit streaks with aurora effect
 */
export function CommitStreakCard({ userStats, theme = 'dark' }: CommitStreakCardProps) {
	const frame = useCurrentFrame();
	const themeColors = themes[theme];

	const currentStreak = userStats.contributionStats?.currentStreak ?? 0;
	const longestStreak = userStats.contributionStats?.longestStreak ?? 0;
	const mostActiveDay = userStats.contributionStats?.mostActiveDay ?? 'N/A';

	const headerAnim = fadeInAndSlideUp(frame, 0);
	const statsAnim = fadeInAndSlideUp(frame, 10);
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
						paddingBottom: cardSettings.padding + 4,
						position: 'relative',
						overflow: 'hidden',
						border: `1px solid ${theme === 'dark' ? 'rgba(48, 54, 61, 0.3)' : 'rgba(208, 215, 222, 0.3)'}`,
						backdropFilter: `blur(${cardSettings.backdropBlur}px)`,
						display: 'flex',
						flexDirection: 'column',
					}}
				>
					{/* Aurora Effect Background */}
					<AuroraEffect theme={theme} />

					{/* Header */}
					<div
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: 8,
							marginBottom: 12,
							position: 'relative',
							zIndex: 1,
							...headerAnim,
						}}
					>
						<FireIcon size={20} color={themeColors.accent} />
						<span
							style={{
								fontSize: 14,
								fontWeight: 600,
								color: themeColors.text,
							}}
						>
							Commit Streak
						</span>
					</div>

					{/* Main Content */}
					<div
						style={{
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-around',
							flex: 1,
							position: 'relative',
							zIndex: 1,
						}}
					>
						{/* Streak Ring */}
						<div style={{ position: 'relative' }}>
							<StreakRing
								currentStreak={currentStreak}
								longestStreak={longestStreak}
								theme={theme}
								size={100}
							/>
						</div>

						{/* Stats */}
						<div
							style={{
								display: 'flex',
								flexDirection: 'column',
								gap: 12,
								...statsAnim,
							}}
						>
							<div>
								<div
									style={{
										fontSize: 11,
										color: themeColors.textMuted,
										textTransform: 'uppercase',
										letterSpacing: '0.5px',
									}}
								>
									Longest Streak
								</div>
								<div
									style={{
										fontSize: 24,
										fontWeight: 700,
										color: themeColors.text,
									}}
								>
									<AnimatedCounter value={longestStreak} duration={2} startFrame={20} />
									<span style={{ fontSize: 12, fontWeight: 400, marginLeft: 4 }}>days</span>
								</div>
							</div>
							<div>
								<div
									style={{
										fontSize: 11,
										color: themeColors.textMuted,
										textTransform: 'uppercase',
										letterSpacing: '0.5px',
									}}
								>
									Most Active Day
								</div>
								<div
									style={{
										fontSize: 16,
										fontWeight: 600,
										color: themeColors.accent,
									}}
								>
									{mostActiveDay}
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</AbsoluteFill>
	);
}
