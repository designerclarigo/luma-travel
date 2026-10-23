export const categories = ['All', 'Beaches', 'Mountains', 'Cities', 'Nature'] as const;
export type Category = (typeof categories)[number];
export type Destination = {
  id: string; name: string; country: string; region: string; rating: number; price: number;
  categories: Category[]; image: number; position: 'center' | 'top' | 'bottom'; duration: string;
  description: string; highlights: string[]; keywords: string;
};

// Curated demonstration content. Prices and ratings are illustrative, not live offers.
export const destinations: Destination[] = [
  {
    id: 'bali', name: 'Bali', country: 'Indonesia', region: 'The island of a thousand temples', rating: 4.9, price: 180,
    categories: ['Nature', 'Beaches'], image: require('../../assets/images/destinations/bali.jpg'), position: 'center', duration: '5 days',
    description: 'Slow mornings, temple gardens and a little room to wander. Find your own rhythm between the green heart of the island and its quiet shores.',
    highlights: ['Temple garden walks', 'A villa among the palms', 'Sunset by the sea'], keywords: 'ubud tropical villa retreat rice terraces stays wellness experiences',
  },
  {
    id: 'braies', name: 'Lago di Braies', country: 'Italy', region: 'A quiet corner of the Dolomites', rating: 4.9, price: 320,
    categories: ['Mountains', 'Nature'], image: require('../../assets/images/onboarding-journey.jpg'), position: 'center', duration: '4 days',
    description: 'Emerald water, mountain air and paths that invite you to take your time. Pack a warm layer and leave the everyday a little further behind.',
    highlights: ['An early lakeside walk', 'A cosy alpine stay', 'A day on the trails'], keywords: 'alpine lake hiking mountains chalet hotel nature experiences',
  },
  {
    id: 'santorini', name: 'Santorini', country: 'Greece', region: 'Whitewashed lanes, endless blue', rating: 4.8, price: 280,
    categories: ['Beaches', 'Cities'], image: require('../../assets/images/destinations/santorini.jpg'), position: 'center', duration: '4 days',
    description: 'Follow the little lanes towards the Aegean. Make time for long lunches, sea views and the kind of evening you wish would last a little longer.',
    highlights: ['A caldera-view stay', 'Small village discoveries', 'An evening by the water'], keywords: 'island oia sea beach boutique hotel sunset stays experiences',
  },
  {
    id: 'kyoto', name: 'Kyoto', country: 'Japan', region: 'Tradition, one small street at a time', rating: 4.9, price: 240,
    categories: ['Cities', 'Nature'], image: require('../../assets/images/destinations/kyoto.jpg'), position: 'center', duration: '6 days',
    description: 'A city best discovered slowly. Step between quiet gardens, old wooden streets and little tea houses, with space in your day for something unexpected.',
    highlights: ['Garden mornings', 'A traditional guesthouse', 'Tea and neighbourhood walks'], keywords: 'culture temple ryokan city garden tea stays experiences',
  },
  {
    id: 'maldives', name: 'The Maldives', country: 'Maldives', region: 'A softer shade of everyday', rating: 4.9, price: 460,
    categories: ['Beaches', 'Nature'], image: require('../../assets/images/destinations/maldives.jpg'), position: 'center', duration: '5 days',
    description: 'Trade busy days for salt air and turquoise water. Bring the essentials, take the slow route and let the horizon do the rest.',
    highlights: ['An island guesthouse', 'Snorkelling in clear water', 'Barefoot beach days'], keywords: 'ocean island lagoon beach resort snorkel stays experiences',
  },
];

export function destinationById(id?: string) { return destinations.find((place) => place.id === id); }
