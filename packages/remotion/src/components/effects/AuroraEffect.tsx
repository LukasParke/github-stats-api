import { useCurrentFrame, interpolate } from 'remotion';
import { Theme } from '../../config';
import { effectColors, animationTiming } from '../../settings';

interface AuroraEffectProps {
	theme?: Theme;
	className?: string;
}

/**
 * Aurora/Northern Lights effect with moving gradient blobs
 * Inspired by Aceternity UI's aurora backgrounds
 */
export function AuroraEffect({ theme = 'dark', className }: AuroraEffectProps) {
	const frame = useCurrentFrame();
	const colors = effectColors.aurora[theme];

	// Fade in animation
	const opacity = interpolate(
		frame,
		[animationTiming.effectFadeStart, animationTiming.effectFadeEnd],
		[0, 1],
		{ extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
	);

	// Generate blob positions based on frame
	const blobs = colors.map((color, i) => {
		const speed = 0.02 + i * 0.005;
		const xOffset = Math.sin(frame * speed + i * 2) * 30;
		const yOffset = Math.cos(frame * speed * 0.7 + i * 1.5) * 20;
		const scale = 1 + Math.sin(frame * speed * 0.5 + i) * 0.2;

		return {
			color,
			x: 20 + i * 25 + xOffset,
			y: 30 + (i % 2) * 40 + yOffset,
			scale,
			blur: 30 + i * 10, // Reduced from 40-90px to 30-70px for better compression
		};
	});

	return (
		<div
			className={className}
			style={{
				position: 'absolute',
				inset: 0,
				overflow: 'hidden',
				opacity,
				pointerEvents: 'none',
			}}
		>
			{blobs.map((blob, i) => (
				<div
					key={i}
					style={{
						position: 'absolute',
						left: `${blob.x}%`,
						top: `${blob.y}%`,
						width: 120,
						height: 120,
						borderRadius: '50%',
						background: `radial-gradient(circle, ${blob.color} 0%, transparent 70%)`,
						transform: `translate(-50%, -50%) scale(${blob.scale})`,
						filter: `blur(${blob.blur}px)`,
						opacity: 0.5, // Reduced from 0.6 for better compression and quality perception
					}}
				/>
			))}
		</div>
	);
}

