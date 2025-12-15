import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Theme, themes, UserStats } from '../../config';
import { LanguageBar } from '../ui/LanguageBar';
import { GridDotEffect } from '../effects/GridDotEffect';
import { fadeInAndSlideUp } from '../../lib/animations';
import { CodeIcon } from '../icons';
import { cardSettings } from '../../settings';

interface TopLanguagesCardProps {
	userStats: UserStats;
	theme?: Theme;
	maxLanguages?: number;
}

/**
 * Card showing top programming languages with animated bars and grid effect
 */
export function TopLanguagesCard({
	userStats,
	theme = 'dark',
	maxLanguages = 6,
}: TopLanguagesCardProps) {
	const frame = useCurrentFrame();
	const themeColors = themes[theme];

	const headerAnim = fadeInAndSlideUp(frame, 0);
	const bgOpacity = theme === 'dark' ? cardSettings.bgOpacityDark : cardSettings.bgOpacityLight;

	// Get top languages and calculate total
	const topLanguages = userStats.topLanguages.slice(0, maxLanguages);
	const total = userStats.codeByteTotal;

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
					{/* Grid Dot Effect Background */}
					<GridDotEffect theme={theme} rows={10} cols={18} />

					{/* Header */}
					<div
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: 8,
							marginBottom: 16,
							position: 'relative',
							zIndex: 1,
							...headerAnim,
						}}
					>
						<CodeIcon size={20} color={themeColors.accent} />
						<span
							style={{
								fontSize: 14,
								fontWeight: 600,
								color: themeColors.text,
							}}
						>
							Top Languages
						</span>
					</div>

					{/* Language Bars */}
					<div
						style={{
							display: 'flex',
							flexDirection: 'column',
							gap: 10,
							flex: 1,
							position: 'relative',
							zIndex: 1,
						}}
					>
						{topLanguages.map((lang, index) => (
							<LanguageBar
								key={lang.languageName}
								name={lang.languageName}
								color={lang.color}
								value={lang.value}
								total={total}
								index={index}
								theme={theme}
								showBytes={false}
							/>
						))}
					</div>
				</div>
			</div>
		</AbsoluteFill>
	);
}
