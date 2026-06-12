import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useAuthStore } from '../store/authStore'

import LoginScreen    from '../screens/LoginScreen'
import SignupScreen   from '../screens/SignupScreen'
import DashboardScreen from '../screens/DashboardScreen'
import WizardStep1    from '../screens/wizard/WizardStep1'
import WizardStep2    from '../screens/wizard/WizardStep2'
import WizardStep3    from '../screens/wizard/WizardStep3'
import WizardStep4    from '../screens/wizard/WizardStep4'

const Stack = createNativeStackNavigator()

const screenOpts = {
  headerStyle:      { backgroundColor: '#0f172a' },
  headerTintColor:  '#ffffff',
  headerTitleStyle: { fontWeight: '700' },
  contentStyle:     { backgroundColor: '#030712' },
}

export default function Navigation() {
  const token = useAuthStore((s) => s.token)

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={screenOpts}>
        {!token ? (
          <>
            <Stack.Screen name="Login"  component={LoginScreen}  options={{ headerShown: false }} />
            <Stack.Screen name="Signup" component={SignupScreen} options={{ title: 'Create Account' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Dashboard"   component={DashboardScreen} options={{ title: 'My Properties', headerBackVisible: false }} />
            <Stack.Screen name="WizardStep1" component={WizardStep1}     options={{ title: 'Property Details' }} />
            <Stack.Screen name="WizardStep2" component={WizardStep2}     options={{ title: 'Floor Plan' }} />
            <Stack.Screen name="WizardStep3" component={WizardStep3}     options={{ title: 'Photo Upload' }} />
            <Stack.Screen name="WizardStep4" component={WizardStep4}     options={{ title: 'Review & Publish' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}
