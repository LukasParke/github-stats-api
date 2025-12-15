import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { Theme, themes, UserStats } from '../../config';
import { AnimatedCounter } from '../effects/AnimatedCounter';
import { BeamsEffect } from '../effects/BeamsEffect';
import { fadeInAndSlideUp } from '../../lib/animations';
import { ContributionIcon } from '../icons';
import { cardSettings } from '../../settings';

interface ContributionCardProps {
	userStats: UserStats;
	theme?: Theme;
}

/**
 * Card showing contribution activity overview with beams effect
 */
export function ContributionCard({ userStats, theme = 'dark' }: ContributionCardProps) {
	const frame = useCurrentFrame();
	const themeColors = themes[theme];

	const headerAnim = fadeInAndSlideUp(frame, 0);
	const statsAnim = fadeInAndSlideUp(frame, 8);
	const bgOpacity = theme === 'dark' ? cardSettings.bgOpacityDark : cardSettings.bgOpacityLight;

	const avgPerDay = userStats.contributionStats?.averagePerDay ?? 0;
	const avgPerWeek = userStats.contributionStats?.averagePerWeek ?? 0;
	const avgPerMonth = userStats.contributionStats?.averagePerMonth ?? 0;

	const statItems = [
		{ label: 'Total', value: userStats.totalContributions },
		{ label: 'Per Day', value: Math.round(avgPerDay * 10) / 10, decimal: true },
		{ label: 'Per Week', value: Math.round(avgPerWeek * 10) / 10, decimal: true },
		{ label: 'Per Month', value: Math.round(avgPerMonth) },
	];

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
						display: 'flex',
						flexDirection: 'column',
					}}
				>
					{/* Beams Effect Background */}
					<BeamsEffect theme={theme} />

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
						<ContributionIcon size={20} color={themeColors.accent} />
						<span
							style={{
								fontSize: 14,
								fontWeight: 600,
								color: themeColors.text,
							}}
						>
							Activity Overview
						</span>
					</div>

					{/* Stats Grid */}
					<div
						style={{
							display: 'grid',
							gridTemplateColumns: 'repeat(4, 1fr)',
							gap: 8,
							flex: 1,
							alignItems: 'center',
							position: 'relative',
							zIndex: 1,
							...statsAnim,
						}}
					>
						{statItems.map((item, index) => (
							<div
								key={item.label}
								style={{
									textAlign: 'center',
									opacity: interpolate(frame - index * 4, [0, 15], [0, 1], {
										extrapolateRight: 'clamp',
										extrapolateLeft: 'clamp',
									}),
								}}
							>
								<div
									style={{
										fontSize: 20,
										fontWeight: 700,
										color: themeColors.text,
									}}
								>
									{item.decimal ? (
										item.value
									) : (
										<AnimatedCounter
											value={item.value as number}
											duration={2}
											startFrame={10 + index * 5}
											format="short"
										/>
									)}
								</div>
								<div
									style={{
										fontSize: 10,
										color: themeColors.textMuted,
										textTransform: 'uppercase',
										letterSpacing: '0.5px',
									}}
								>
									{item.label}
								</div>
							</div>
						))}
					</div>
				</div>
			</div>
		</AbsoluteFill>
	);
}
