import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { MealWidget } from './src/components/MealWidget'; // Kendi dosya yoluna göre düzenleyebilirsin
import widgetTaskHandler from './widget-task-handler';

registerWidgetTaskHandler(widgetTaskHandler);
async function nameWidgetTaskHandler({ widgetAction, widgetInfo }) {
  const widgetName = widgetInfo.widgetName;

  if (widgetAction === 'WIDGET_ADDED' || widgetAction === 'WIDGET_UPDATE' || widgetAction === 'WIDGET_RESIZED') {
    // Burada AppContext verisini AsyncStorage veya yerel cache üzerinden okuyup widget'a basabiliriz
    // Örn: AsyncStorage.getItem('mealPlan')
    
    // Şimdilik örnek veriyle render edelim:
    const todayData = {
      breakfast: { recipeTitle: 'Yulaf Lapası' },
      lunch: { recipeTitle: 'Tavuklu Salata' },
      dinner: { recipeTitle: 'Fırında Somon' }
    };

    widgetAction.render(<MealWidget todayMeal={todayData} dayName="Çarşamba" />);
  }
}

export default createWidgetTaskHandler(nameWidgetTaskHandler);
