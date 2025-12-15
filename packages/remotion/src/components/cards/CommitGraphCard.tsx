import { AbsoluteFill, useCurrentFrame, interpolate, random } from 'remotion';
import { Theme, themes, UserStats } from '../../config';
import { SpotlightEffect } from '../effects/SpotlightEffect';
import { fadeInAndSlideUp } from '../../lib/animations';
import { CommitIcon } from '../icons';
import { cardSettings, effectColors } from '../../settings';

type AnimationStyle = 'wave' | 'rain' | 'cascade';

interface CommitGraphCardProps {
	userStats: UserStats;
	theme?: Theme;
	animationStyle?: AnimationStyle;
}

/**
 * GitHub-style contribution graph with multiple animation styles
 */
export function CommitGraphCard({ 
	userStats, 
	theme = 'dark',
	animationStyle = 'wave'
}: CommitGraphCardProps) {
	const frame = useCurrentFrame();
	const themeColors = themes[theme];
	const graphColors = effectColors.contributionGraph[theme];

	const headerAnim = fadeInAndSlideUp(frame, 0);
	const bgOpacity = theme === 'dark' ? cardSettings.bgOpacityDark : cardSettings.bgOpacityLight;

	// Calculate graph dimensions to fit card width
	const cardInnerWidth = 450 - (cardSettings.outerPadding * 2) - (cardSettings.padding * 2);
	const weeks = 30; // More weeks to fill width
	const gap = 2;
	const squareSize = Math.floor((cardInnerWidth - (weeks - 1) * gap) / weeks);
	const squareRadius = 2;

	const graphWidth = weeks * (squareSize + gap) - gap;
	const graphHeight = 7 * (squareSize + gap) - gap;

	// Generate contribution data
	const generateGraphData = () => {
		const data: number[][] = [];
		
		for (let week = 0; week < weeks; week++) {
			const weekData: number[] = [];
			for (let day = 0; day < 7; day++) {
				const seed = week * 7 + day;
				const baseLevel = Math.sin(seed * 0.3) * 0.5 + 0.5;
				const variance = Math.cos(seed * 0.7) * 0.3;
				const level = Math.max(0, Math.min(4, Math.floor((baseLevel + variance) * 5)));
				weekData.push(level);
			}
			data.push(weekData);
		}
		return data;
	};

	const graphData = generateGraphData();

	const getColor = (level: number) => {
		switch (level) {
			case 0: return graphColors.empty;
			case 1: return graphColors.level1;
			case 2: return graphColors.level2;
			case 3: return graphColors.level3;
			case 4: return graphColors.level4;
			default: return graphColors.empty;
		}
	};

	// Center of the graph for spiral calculation
	const centerX = weeks / 2;
	const centerY = 3.5; // Middle of 7 days

	// Calculate animation delay based on style
	const getAnimationDelay = (weekIndex: number, dayIndex: number): number => {
		switch (animationStyle) {
			case 'wave':
				// Diagonal wave from top-left to bottom-right
				return (weekIndex + dayIndex) * 0.8;
			case 'rain':
				// Rain effect - columns fall at different times (deterministic)
				return weekIndex * 1.2 + random(`rain-${weekIndex}-${dayIndex}`) * 5;
			case 'cascade': {
				// Spiral from center - distance from center determines delay
				const dx = weekIndex - centerX;
				const dy = dayIndex - centerY;
				const distance = Math.sqrt(dx * dx + dy * dy);
				const angle = Math.atan2(dy, dx);
				// Combine distance and angle for spiral effect
				return distance * 1.5 + (angle + Math.PI) * 2;
			}
			default:
				return (weekIndex + dayIndex) * 0.8;
		}
	};

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
						paddingBottom: cardSettings.padding + 2,
						position: 'relative',
						overflow: 'hidden',
						border: `1px solid ${theme === 'dark' ? 'rgba(48, 54, 61, 0.3)' : 'rgba(208, 215, 222, 0.3)'}`,
						backdropFilter: `blur(${cardSettings.backdropBlur}px)`,
						display: 'flex',
						flexDirection: 'column',
					}}
				>
					{/* Spotlight Effect Background */}
					<SpotlightEffect theme={theme} />

					{/* Header */}
					<div
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: 8,
							marginBottom: 10,
							position: 'relative',
							zIndex: 1,
							...headerAnim,
						}}
					>
						<CommitIcon size={18} color={themeColors.accent} />
						<span
							style={{
								fontSize: 13,
								fontWeight: 600,
								color: themeColors.text,
							}}
						>
							Contribution Graph
						</span>
						<span
							style={{
								fontSize: 11,
								color: themeColors.textMuted,
								marginLeft: 'auto',
							}}
						>
							{userStats.totalContributions.toLocaleString()} total
						</span>
					</div>

					{/* Graph Container */}
					<div
						style={{
							flex: 1,
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							position: 'relative',
							zIndex: 1,
						}}
					>
						<svg
							width={graphWidth}
							height={graphHeight}
							style={{ overflow: 'visible' }}
						>
							{graphData.map((week, weekIndex) =>
								week.map((level, dayIndex) => {
									const x = weekIndex * (squareSize + gap);
									const y = dayIndex * (squareSize + gap);
									const delay = getAnimationDelay(weekIndex, dayIndex);
									
									const squareOpacity = interpolate(
										frame - delay,
										[0, 12],
										[0, 1],
										{ extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
									);
									
									const squareScale = interpolate(
										frame - delay,
										[0, 15],
										[0, 1],
										{ extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
									);

									// For rain effect, add a "drop" from top
									const yOffset = animationStyle === 'rain' 
										? interpolate(
											frame - delay,
											[0, 12],
											[-20, 0],
											{ extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
										)
										: 0;

									return (
										<rect
											key={`${weekIndex}-${dayIndex}`}
											x={x + (squareSize * (1 - squareScale)) / 2}
											y={y + yOffset + (squareSize * (1 - squareScale)) / 2}
											width={squareSize * squareScale}
											height={squareSize * squareScale}
											rx={squareRadius}
											fill={getColor(level)}
											opacity={squareOpacity}
										/>
									);
								})
							)}
						</svg>
					</div>

					{/* Legend */}
					<div
						style={{
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'flex-end',
							gap: 3,
							marginTop: 6,
							position: 'relative',
							zIndex: 1,
							...fadeInAndSlideUp(frame, 50),
						}}
					>
						<span style={{ fontSize: 9, color: themeColors.textMuted, marginRight: 3 }}>
							Less
						</span>
						{[0, 1, 2, 3, 4].map((level) => (
							<div
								key={level}
								style={{
									width: 8,
									height: 8,
									borderRadius: 2,
									backgroundColor: getColor(level),
								}}
							/>
						))}
						<span style={{ fontSize: 9, color: themeColors.textMuted, marginLeft: 3 }}>
							More
						</span>
					</div>
				</div>
			</div>
		</AbsoluteFill>
	);
}
