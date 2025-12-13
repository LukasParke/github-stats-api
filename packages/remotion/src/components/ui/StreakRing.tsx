import { useCurrentFrame, interpolate } from 'remotion';
import { Theme, themes } from '../../config';
import { AnimatedCounter } from '../effects/AnimatedCounter';

interface StreakRingProps {
	currentStreak: number;
	longestStreak: number;
	theme?: Theme;
	size?: number;
}

/**
 * Circular progress ring showing streak information
 */
export function StreakRing({
	currentStreak,
	longestStreak,
	theme = 'dark',
	size = 120,
}: StreakRingProps) {
	const frame = useCurrentFrame();
	const themeColors = themes[theme];

	const strokeWidth = 8;
	const radius = (size - strokeWidth) / 2;
	const circumference = 2 * Math.PI * radius;
	const center = size / 2;

	// Calculate progress (current vs longest streak)
	const progress = longestStreak > 0 ? Math.min(currentStreak / longestStreak, 1) : 0;

	// Animate the ring
	const animatedProgress = interpolate(frame, [10, 60], [0, progress], {
		extrapolateRight: 'clamp',
		extrapolateLeft: 'clamp',
	});

	const strokeDashoffset = circumference - animatedProgress * circumference;

	// Fade in
	const opacity = interpolate(frame, [0, 20], [0, 1], {
		extrapolateRight: 'clamp',
		extrapolateLeft: 'clamp',
	});

	// Scale animation
	const scale = interpolate(frame, [0, 25], [0.8, 1], {
		extrapolateRight: 'clamp',
		extrapolateLeft: 'clamp',
	});

	// Keep the ring glow subtle so it doesn't bleed into adjacent content.
	const glow =
		theme === 'dark'
			? 'drop-shadow(0 0 4px rgba(88, 166, 255, 0.35))'
			: 'drop-shadow(0 0 3px rgba(9, 105, 218, 0.22))';

	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				gap: 8,
				opacity,
				transform: `scale(${scale})`,
				position: 'relative',
			}}
		>
			{/* Ring + center content are clipped to this box */}
			<div style={{ width: size, height: size, position: 'relative' }}>
				<svg
					width={size}
					height={size}
					style={{ transform: 'rotate(-90deg)', display: 'block' }}
				>
					{/* Background ring */}
					<circle
						cx={center}
						cy={center}
						r={radius}
						fill="none"
						stroke={theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}
						strokeWidth={strokeWidth}
					/>
					{/* Progress ring */}
					<circle
						cx={center}
						cy={center}
						r={radius}
						fill="none"
						stroke={themeColors.accent}
						strokeWidth={strokeWidth}
						strokeLinecap="round"
						strokeDasharray={circumference}
						strokeDashoffset={strokeDashoffset}
						style={{ filter: glow }}
					/>
				</svg>

				{/* Center content */}
				<div
					style={{
						position: 'absolute',
						inset: 0,
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						justifyContent: 'center',
						pointerEvents: 'none',
					}}
				>
					<span
						style={{
							fontSize: 28,
							fontWeight: 700,
							color: themeColors.text,
						}}
					>
						<AnimatedCounter value={currentStreak} duration={2} startFrame={15} />
					</span>
					<span
						style={{
							fontSize: 10,
							color: themeColors.textMuted,
							textTransform: 'uppercase',
							letterSpacing: '0.5px',
						}}
					>
						Day Streak
					</span>
				</div>
			</div>
		</div>
	);
}

