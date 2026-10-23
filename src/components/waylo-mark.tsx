import Svg, { Circle, Path } from 'react-native-svg';

type WayloMarkProps = {
  size?: number;
  color?: string;
  accentColor?: string;
};

export function WayloMark({
  size = 44,
  color = '#FAF9F6',
  accentColor = '#D6BD86',
}: WayloMarkProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 100 100">
      <Path
        d="M24 75c5-15 17-27 31-28 10-1 16 5 13 12-2 5-9 7-13 3-6-6 1-20 17-37"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="9"
      />
      <Path
        d="m64 33 18-20-4 25-7-7-8 2Z"
        fill={accentColor}
        stroke={color}
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <Circle cx="24" cy="75" r="5" fill={accentColor} stroke={color} strokeWidth="2" />
    </Svg>
  );
}
