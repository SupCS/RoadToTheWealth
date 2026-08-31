export type ThemeId =
  | 'wealth'
  | 'ocean'
  | 'grape'
  | 'sunset'
  | 'cherry'
  | 'forest'
  | 'arctic'
  | 'lavender'
  | 'coffee'
  | 'graphite'
  | 'pirate'
  | 'contrast';

export type AppTheme = {
  id: ThemeId;
  name: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  primary: string;
  accent: string;
  border: string;
  positive: string;
  warning: string;
  danger: string;
};

export const themes: AppTheme[] = [
  { id: 'wealth', name: 'Wealth', background: '#F3FAF6', surface: '#FFFFFF', text: '#10261C', muted: '#617269', primary: '#087F5B', accent: '#D6A321', border: '#CFE3D7', positive: '#198754', warning: '#B7791F', danger: '#C53030' },
  { id: 'ocean', name: 'Ocean', background: '#F0F8FF', surface: '#FFFFFF', text: '#102A43', muted: '#627D98', primary: '#1261A0', accent: '#00A8CC', border: '#C7DDF0', positive: '#168B65', warning: '#B26A00', danger: '#C53B3B' },
  { id: 'grape', name: 'Grape', background: '#F8F5FC', surface: '#FFFFFF', text: '#2B1838', muted: '#76637F', primary: '#6F42C1', accent: '#A855F7', border: '#DED2EC', positive: '#23845B', warning: '#A96F00', danger: '#C33C64' },
  { id: 'sunset', name: 'Sunset', background: '#FFF7F2', surface: '#FFFFFF', text: '#3A2118', muted: '#816A61', primary: '#E05A33', accent: '#E84A72', border: '#F0D7CC', positive: '#2A875D', warning: '#B56B00', danger: '#C73548' },
  { id: 'cherry', name: 'Cherry', background: '#FFF5F7', surface: '#FFFFFF', text: '#38151D', muted: '#80616A', primary: '#B42345', accent: '#F06292', border: '#EACDD5', positive: '#21845B', warning: '#A97000', danger: '#B42345' },
  { id: 'forest', name: 'Forest', background: '#F3F8F1', surface: '#FFFFFF', text: '#172B18', muted: '#667666', primary: '#2F6B3C', accent: '#84A83F', border: '#D1E1CC', positive: '#24734A', warning: '#A36D0B', danger: '#BC3F3F' },
  { id: 'arctic', name: 'Arctic', background: '#F2FAFC', surface: '#FFFFFF', text: '#142C38', muted: '#607882', primary: '#287EA1', accent: '#4F66D0', border: '#CDE4EA', positive: '#1E8466', warning: '#AA7100', danger: '#C33E54' },
  { id: 'lavender', name: 'Lavender', background: '#FAF6FF', surface: '#FFFFFF', text: '#30203B', muted: '#75667E', primary: '#8064A2', accent: '#C04BB3', border: '#E3D6EB', positive: '#27805C', warning: '#A66F00', danger: '#C13D62' },
  { id: 'coffee', name: 'Coffee', background: '#FAF6F1', surface: '#FFFFFF', text: '#33251D', muted: '#78685D', primary: '#76513B', accent: '#D09235', border: '#E2D5C9', positive: '#397A50', warning: '#A96600', danger: '#B9473D' },
  { id: 'graphite', name: 'Graphite', background: '#EEF1F4', surface: '#FFFFFF', text: '#18202A', muted: '#66717D', primary: '#3E4C59', accent: '#3273DC', border: '#CFD6DD', positive: '#27825D', warning: '#A97000', danger: '#C13E45' },
  { id: 'pirate', name: 'Pirate', background: '#1B1D20', surface: '#282B30', text: '#FAF4DF', muted: '#B9B19B', primary: '#E0B12F', accent: '#D46B35', border: '#484A4B', positive: '#65B779', warning: '#E0B12F', danger: '#EC6666' },
  { id: 'contrast', name: 'High Contrast', background: '#000000', surface: '#171717', text: '#FFFFFF', muted: '#D6D6D6', primary: '#FFE500', accent: '#65D9FF', border: '#FFFFFF', positive: '#72F2A3', warning: '#FFE500', danger: '#FF7474' },
];

