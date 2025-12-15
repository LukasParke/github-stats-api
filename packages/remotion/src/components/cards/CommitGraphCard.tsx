import { AbsoluteFill, useCurrentFrame, interpolate, random } from 'remotion';
import { Theme, themes, UserStats } from '../../config';
import { SpotlightEffect } from '../effects/SpotlightEffect';
import { fadeInAndSlideUp } from '../../lib/animations';
import { CommitIcon } from '../icons';
import { cardSettings, effectColors, commitGraphSettings } from '../../settings';

type AnimationStyle = 'wave' | 'rain' | 'cascade';

interface CommitGraphCardProps {
	userStats: UserStats;
	theme?: Theme;
	animationStyle?: AnimationStyle;
}

/**
 * Map contribution count to color level (0-4)
 */
function getContributionLevel(count: number): number {
	if (count === 0) return 0;
	if (count >= 1 && count <= 9) return 1;
	if (count >= 10 && count <= 19) return 2;
	if (count >= 20 && count <= 29) return 3;
	return 4; // 30+
}

/**
 * GitHub-style contribution graph with real data only and animations
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

	// Get real contribution calendar data - NO FALLBACK
	const calendar = userStats.contributionsCollection?.contributionCalendar;
	const weeks = calendar?.weeks || [];
	
	// Use actual weeks from data (should be 53 for full year, but use what we have)
	const actualWeeks = weeks.length;
	
	// If no data, show error state
	if (actualWeeks === 0) {
		return (
			<AbsoluteFill style={{ backgroundColor: theme === 'dark' ? '#0d1117' : '#ffffff' }}>
				<div
					style={{
						width: '100%',
						height: '100%',
						padding: cardSettings.outerPadding,
						fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
					}}
				>
					<div
						style={{
							backgroundColor: theme === 'dark' 
								? `rgba(22, 27, 34, ${bgOpacity})`
								: `rgba(255, 255, 255, ${bgOpacity})`,
							borderRadius: cardSettings.borderRadius,
							padding: cardSettings.padding,
							border: `1px solid ${theme === 'dark' ? 'rgba(48, 54, 61, 0.3)' : 'rgba(208, 215, 222, 0.3)'}`,
							textAlign: 'center',
						}}
					>
						<div style={{ fontSize: 28, color: themeColors.textMuted, marginBottom: 16 }}>
							No contribution data available
						</div>
						<div style={{ fontSize: 22, color: themeColors.textMuted }}>
							Contribution calendar data is required
						</div>
					</div>
				</div>
			</AbsoluteFill>
		);
	}

	// Calculate graph dimensions to fit within card - no labels, use full width
	const cardInnerWidth = 900 - (cardSettings.outerPadding * 2) - (cardSettings.padding * 2);
	const availableGraphWidth = cardInnerWidth; // Use full width since no labels
	
	// Calculate square size to fit actual number of weeks
	const gap = commitGraphSettings.gap;
	const targetWeeks = actualWeeks; // Use actual number of weeks from data
	const squareSize = Math.floor((availableGraphWidth - (targetWeeks - 1) * gap) / targetWeeks);
	const squareRadius = Math.max(2, Math.floor(squareSize * 0.18)); // Proportional radius
	
	// Graph area dimensions
	const graphWidth = targetWeeks * (squareSize + gap) - gap;
	const graphHeight = 7 * (squareSize + gap) - gap;
	
	// Total SVG dimensions (no labels, so same as graph)
	const svgWidth = graphWidth;
	const svgHeight = graphHeight;

	// Process contribution data into levels - ONLY REAL DATA
	const graphData: Array<Array<{ level: number; date: string }>> = [];
	
	weeks.forEach((week) => {
		const weekData: Array<{ level: number; date: string }> = [];
		
		week.contributionDays.forEach((day) => {
			const level = getContributionLevel(day.contributionCount || 0);
			weekData.push({ level, date: day.date || '' });
		});
		
		graphData.push(weekData);
	});

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
	const centerX = targetWeeks / 2;
	const centerY = 3.5; // Middle of 7 days

	// Calculate animation delay based on style
	const getAnimationDelay = (weekIndex: number, dayIndex: number): number => {
		switch (animationStyle) {
			case 'wave':
				// Diagonal wave from top-left to bottom-right
				return (weekIndex + dayIndex) * 0.6;
			case 'rain':
				// Rain effect - columns fall at different times (deterministic)
				return weekIndex * 1.0 + random(`rain-${weekIndex}-${dayIndex}`) * 4;
			case 'cascade': {
				// Spiral from center - distance from center determines delay
				const dx = weekIndex - centerX;
				const dy = dayIndex - centerY;
				const distance = Math.sqrt(dx * dx + dy * dy);
				const angle = Math.atan2(dy, dx);
				// Combine distance and angle for spiral effect
				return distance * 1.2 + (angle + Math.PI) * 1.5;
			}
			default:
				return (weekIndex + dayIndex) * 0.6;
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
							gap: 16,
							marginBottom: 20,
							position: 'relative',
							zIndex: 1,
							...headerAnim,
						}}
					>
						<CommitIcon size={36} color={themeColors.accent} />
						<span
							style={{
								fontSize: 26,
								fontWeight: 600,
								color: themeColors.text,
							}}
						>
							Contribution Graph
						</span>
						<span
							style={{
								fontSize: 22,
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
							overflow: 'hidden',
						}}
					>
						<svg
							width={svgWidth}
							height={svgHeight}
							style={{ overflow: 'visible' }}
						>
							{/* Contribution Squares */}
							<g>
								{graphData.map((week, weekIndex) =>
									week.map(({ level, date }, dayIndex) => {
										const x = weekIndex * (squareSize + gap);
										const y = dayIndex * (squareSize + gap);
										const delay = getAnimationDelay(weekIndex, dayIndex);
										
										const squareOpacity = interpolate(
											frame - delay,
											[0, 15],
											[0, 1],
											{ extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
										);
										
										const squareScale = interpolate(
											frame - delay,
											[0, 18],
											[0, 1],
											{ extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
										);

										// For rain effect, add a "drop" from top
										const yOffset = animationStyle === 'rain' 
											? interpolate(
												frame - delay,
												[0, 15],
												[-30, 0],
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
							</g>
						</svg>
					</div>
				</div>
			</div>
		</AbsoluteFill>
	);
}
