import { useContext, useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AppContext } from '../context/AppContext';

export default function ResetPasswordScreen() {
  const context = useContext(AppContext);

  useEffect(() => {
    if (context?.setIsPasswordRecovery) {
      context.setIsPasswordRecovery(true);
    }
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FA' }}>
      <ActivityIndicator size="large" color="#1A1A1A" />
    </View>
  );
}