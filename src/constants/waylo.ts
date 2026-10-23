export const palette = {
  canvas: '#FAF9F6',
  canvasDeep: '#EEEDE5',
  ink: '#18211E',
  muted: '#5F6A62',
  pine: '#153E35',
  pineDeep: '#153E35',
  champagne: '#D6BD86',
  sage: '#E6EBE2',
  white: '#FFFFFF',
  border: '#DEDFD5',
  danger: '#923E35',
} as const;

export const typography = {
  editorial: 'WayloEditorial',
  sans: 'WayloSans',
  medium: 'WayloMedium',
} as const;

export const rhythm = { space: 8, gutter: 24, radius: 24, controlRadius: 16, target: 48, contentWidth: 720 } as const;
export const motion = {
  press: { damping: 24, stiffness: 360, mass: 0.7 },
  sheet: { damping: 30, stiffness: 280, mass: 0.85, overshootClamping: true },
  fade: 160,
} as const;

export const travelPhotos = {
  journey: require('../../assets/images/onboarding-journey.jpg'),
  packing: require('../../assets/images/onboarding-packing.jpg'),
  weather: require('../../assets/images/onboarding-weather.jpg'),
};

export type PhotoName = keyof typeof travelPhotos;

export type OnboardingSlide = {
  eyebrow: string;
  title: string;
  description: string;
  photo: 'journey' | 'packing' | 'weather';
};

export const onboardingSlides: OnboardingSlide[] = [
  {
    eyebrow: 'TRAVEL LIGHT. FEEL FREE.',
    title: 'Less packing.\nMore possibility.',
    description: 'Keep your travel essentials in one place.\nLeave a little room for the unexpected.',
    photo: 'journey',
  },
  {
    eyebrow: 'A LITTLE ORDER. A LOT OF CALM.',
    title: 'A place for\nevery essential.',
    description: 'Your essentials, thoughtfully organised.\nOne list. A little less to think about.',
    photo: 'packing',
  },
  {
    eyebrow: 'READY FOR WHAT’S NEXT',
    title: 'All set.\nGo make memories.',
    description: 'Feel good about what’s in your bag.\nThe rest of the journey is yours.',
    photo: 'weather',
  },
];
