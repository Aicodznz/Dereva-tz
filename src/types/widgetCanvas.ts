export type WidgetCategoryType = 'PRODUCT' | 'CATEGORY' | 'BRAND' | 'MEDIA_BANNER' | 'STORE';

export type WidgetDisplayStyle = 
  | 'circle' 
  | 'card_grid' 
  | 'tabs_products' 
  | 'checkmark' 
  | 'grid' 
  | 'horizontal' 
  | 'item_list'
  | 'banner'
  | 'u_shape_grid'
  | 'cover_grid'
  | 'horizontal_scroll'
  | 'feed_cards';

export type ContentSourceType = 'featured' | 'recent' | 'custom';

export type DeviceTarget = 'all' | 'mobile_only' | 'laptop_only';

export type BackgroundType = 'solid' | 'image' | 'gif' | 'video';

export interface CanvasWidget {
  id: string;
  order: number;
  type: WidgetCategoryType;
  title: string;
  subtitle?: string;
  showTitleInApp: boolean;
  active: boolean;
  displayStyle: WidgetDisplayStyle;
  contentSource: ContentSourceType;
  selectedItemIds: string[];
  
  // Layout
  deviceTarget: DeviceTarget;
  mobileVisible: boolean;
  desktopVisible: boolean;
  mobileItemsPerRow: number; // 1, 2, 3
  desktopItemsPerRow: number; // 2, 3, 4, 5, 6, 7
  rowsCount: number; // 1 to 6
  
  // Animation & Background
  autoScrollAnimation: boolean;
  customBackgroundEnabled: boolean;
  backgroundType: BackgroundType;
  backgroundColor: string;
  backgroundImageUrl?: string;
  backgroundVideoUrl?: string;
  showViewAllButton: boolean;

  // Metadata tags
  tagLabel?: string;
  tagLayout?: string;
  isAuto?: boolean;
}

export interface QuickAccessCard {
  id: string;
  title: string;
  type: 'category' | 'vendor' | 'custom' | 'product';
  link: string;
  iconUrl: string;
  active: boolean;
}

export interface AppModule {
  id: string;
  name: string;
  featureVertical: 'grocery' | 'food' | 'pharmacy' | 'ecommerce' | 'taxi' | 'parcel' | 'handyman' | 'events' | 'print' | 'bus' | 'rent' | 'custom';
  iconUrl: string;
  active: boolean;
  
  // Top header bar background
  headerBgType: 'gradient_2_color' | 'solid' | 'gradient_3_color' | 'image';
  primaryColor: string;
  secondaryColor: string;
  gradientDirection: string;
  
  // Quick access cards background
  cardsBgMediaType: 'mp4_video' | 'gif' | 'image' | 'none';
  cardsBgMediaUrl: string;
  stickyHeaderPinnedColor: string;
  
  // Quick cards shortcuts
  horizontalScrollLayout: boolean;
  quickCards: QuickAccessCard[];
}

export interface GlobalAppModulesSettings {
  moduleSwitcherBar: boolean;
  backgroundWallpapers: boolean;
  quickAccessCards: boolean;
  headerModuleIconStyle: 'style1' | 'style2'; // style1: Only Module Image, style2: Module Image & Name
}
