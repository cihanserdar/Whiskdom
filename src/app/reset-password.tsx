import { useContext, useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Colors } from '../constants/Colors';
import { AppContext } from '../context/AppContext';

export default function ResetPasswordScreen() {
  const context = useContext(AppContext);

  useEffect(() => {
    if (context?.setIsPasswordRecovery) {
      context.setIsPasswordRecovery(true);
    }
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surface }}>
      <ActivityIndicator size="large" color={Colors.textDark} />
    </View>
  );
}