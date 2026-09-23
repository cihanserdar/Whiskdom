import { FlexWidget, TextWidget } from 'react-native-android-widget';

interface MealWidgetProps {
  todayMeal?: {
    breakfast?: { recipeTitle: string };
    lunch?: { recipeTitle: string };
    dinner?: { recipeTitle: string };
  };
  dayName?: string;
}

export function MealWidget({ todayMeal, dayName = 'Bugün' }: MealWidgetProps) {
  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 12,
        justifyContent: 'space-between',
      }}
    >
      {/* Başlık */}
      <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <TextWidget text={`📌 ${dayName} Menüsü`} style={{ fontSize: 14, fontWeight: 'bold', color: '#1A1A1A' }} />
        <TextWidget text="Whiskdom" style={{ fontSize: 10, color: '#6C757D' }} />
      </FlexWidget>

      {/* Öğünler */}
      <FlexWidget style={{ flexDirection: 'column' }}>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <TextWidget text="🌅 Kahvaltı: " style={{ fontSize: 11, fontWeight: 'bold', color: '#4A5568' }} />
          <TextWidget text={todayMeal?.breakfast?.recipeTitle || 'Plan yok'} style={{ fontSize: 11, color: '#1A1A1A' }} />
        </FlexWidget>

        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <TextWidget text="☀️ Öğle: " style={{ fontSize: 11, fontWeight: 'bold', color: '#4A5568' }} />
          <TextWidget text={todayMeal?.lunch?.recipeTitle || 'Plan yok'} style={{ fontSize: 11, color: '#1A1A1A' }} />
        </FlexWidget>

        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TextWidget text="🌙 Akşam: " style={{ fontSize: 11, fontWeight: 'bold', color: '#4A5568' }} />
          <TextWidget text={todayMeal?.dinner?.recipeTitle || 'Plan yok'} style={{ fontSize: 11, color: '#1A1A1A' }} />
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}