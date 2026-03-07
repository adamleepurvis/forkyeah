import { useColorScheme } from 'react-native';

const light = {
  bg: '#FFF8F3',
  card: '#ffffff',
  text: '#1A1A2E',
  textSec: '#555555',
  textMuted: '#999999',
  border: '#E8E0D8',
  borderLight: '#F0E8E0',
  red: '#CC0000',
  redLight: '#FFF0F0',
  redBorder: '#FFCCCC',
  tagProtein: '#F0E8E0',
  tagTiming: '#E8F0FF',
  tagSource: '#F0F0F0',
  tagText: '#666666',
  inputBg: '#ffffff',
  placeholder: '#bbbbbb',
  chipBg: '#ffffff',
  overlay: 'rgba(0,0,0,0.3)',
  varietyChip: '#F5F5F5',
  warnChip: '#FFF0F0',
  warnBorder: '#FFCCCC',
  accountSheet: '#ffffff',
  signOutBg: '#FFF5F5',
  signOutBorder: '#FFD0D0',
  swipeDelete: '#E53935',
};

const dark = {
  bg: '#111118',
  card: '#1E1E2C',
  text: '#F0EBE3',
  textSec: '#AAAAAA',
  textMuted: '#666666',
  border: '#2A2A3A',
  borderLight: '#222230',
  red: '#CC0000',
  redLight: '#2A1010',
  redBorder: '#551111',
  tagProtein: '#2A2020',
  tagTiming: '#1A2030',
  tagSource: '#222228',
  tagText: '#AAAAAA',
  inputBg: '#1E1E2C',
  placeholder: '#555566',
  chipBg: '#1E1E2C',
  overlay: 'rgba(0,0,0,0.6)',
  varietyChip: '#222228',
  warnChip: '#2A1818',
  warnBorder: '#441111',
  accountSheet: '#1E1E2C',
  signOutBg: '#2A1010',
  signOutBorder: '#441111',
  swipeDelete: '#E53935',
};

export type Colors = typeof light;

export function useColors(): Colors {
  const scheme = useColorScheme();
  return scheme === 'dark' ? dark : light;
}
