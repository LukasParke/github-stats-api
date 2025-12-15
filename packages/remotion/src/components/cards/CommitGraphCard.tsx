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
 * Get month abbreviation from date string
 */
function getMonthAbbr(dateStr: string): string {
	const date = new Date(dateStr);
	return date.toLocaleDateString('en-US', { month: 'short' });
}

/**
 * Get day of week abbreviation (S, M, T, W, T, F, S)
 */
const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * GitHub-style contribution graph with real data only, month/day labels, and animations
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

	// Calculate graph dimensions to fit within card
	const cardInnerWidth = 900 - (cardSettings.outerPadding * 2) - (cardSettings.padding * 2);
	const dayLabelWidth = 48; // Space for day labels on left
	const monthLabelHeight = 32; // Space for month labels on top
	const availableGraphWidth = cardInnerWidth - dayLabelWidth;
	
	// Calculate square size to fit actual number of weeks
	const gap = commitGraphSettings.gap;
	const targetWeeks = actualWeeks; // Use actual number of weeks from data
	const squareSize = Math.floor((availableGraphWidth - (targetWeeks - 1) * gap) / targetWeeks);
	const squareRadius = Math.max(2, Math.floor(squareSize * 0.18)); // Proportional radius
	
	// Graph area dimensions
	const graphWidth = targetWeeks * (squareSize + gap) - gap;
	const graphHeight = 7 * (squareSize + gap) - gap;
	
	// Total SVG dimensions
	const svgWidth = dayLabelWidth + graphWidth;
	const svgHeight = monthLabelHeight + graphHeight;

	// Process contribution data into levels - ONLY REAL DATA
	const graphData: Array<Array<{ level: number; date: string }>> = [];
	const monthPositions: Array<{ weekIndex: number; month: string }> = [];
	
	let lastMonth = '';
	weeks.forEach((week, weekIndex) => {
		const weekData: Array<{ level: number; date: string }> = [];
		
		week.contributionDays.forEach((day, dayIndex) => {
			const level = getContributionLevel(day.contributionCount || 0);
			weekData.push({ level, date: day.date || '' });
			
			// Track month boundaries for labels (check first day of week)
			if (dayIndex === 0 && day.date) {
				const month = getMonthAbbr(day.date);
				if (month !== lastMonth) {
					monthPositions.push({ weekIndex, month });
					lastMonth = month;
				}
			}
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
						paddingBottom: cardSettings.padding + 4,
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
							{/* Month Labels */}
							{monthPositions.map(({ weekIndex, month }, idx) => {
								const x = dayLabelWidth + weekIndex * (squareSize + gap);
								const monthOpacity = interpolate(
									frame - idx * 2,
									[0, 15],
									[0, 1],
									{ extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
								);
								
								return (
									<text
										key={`month-${weekIndex}`}
										x={x}
										y={24}
										fontSize={22}
										fill={themeColors.textMuted}
										opacity={monthOpacity}
										style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif' }}
									>
										{month}
									</text>
								);
							})}

							{/* Day Labels */}
							{dayLabels.map((day, dayIndex) => {
								const dayOpacity = interpolate(
									frame - dayIndex * 2,
									[0, 15],
									[0, 1],
									{ extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
								);
								
								return (
									<text
										key={`day-${dayIndex}`}
										x={dayLabelWidth - 12}
										y={monthLabelHeight + dayIndex * (squareSize + gap) + squareSize / 2 + 8}
										fontSize={22}
										fill={themeColors.textMuted}
										opacity={dayOpacity}
										textAnchor="end"
										style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif' }}
									>
										{day}
									</text>
								);
							})}

							{/* Contribution Squares */}
							<g transform={`translate(${dayLabelWidth}, ${monthLabelHeight})`}>
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

					{/* Legend */}
					<div
						style={{
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'flex-end',
							gap: 6,
							marginTop: 12,
							position: 'relative',
							zIndex: 1,
							...fadeInAndSlideUp(frame, 50),
						}}
					>
						<span style={{ fontSize: 18, color: themeColors.textMuted, marginRight: 6 }}>
							Less
						</span>
						{[0, 1, 2, 3, 4].map((level) => (
							<div
								key={level}
								style={{
									width: 16,
									height: 16,
									borderRadius: 4,
									backgroundColor: getColor(level),
								}}
							/>
						))}
						<span style={{ fontSize: 18, color: themeColors.textMuted, marginLeft: 6 }}>
							More
						</span>
					</div>
				</div>
			</div>
		</AbsoluteFill>
	);
}
