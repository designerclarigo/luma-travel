import * as Location from 'expo-location';
import { type CityAdapter } from './current-city';

export const deviceCityAdapter: CityAdapter = {
  permission: Location.getForegroundPermissionsAsync,
  requestPermission: Location.requestForegroundPermissionsAsync,
  servicesEnabled: Location.hasServicesEnabledAsync,
  position: () => Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
  reverse: Location.reverseGeocodeAsync,
};
