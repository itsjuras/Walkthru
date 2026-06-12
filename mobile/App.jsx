import 'react-native-gesture-handler'
import { registerRootComponent } from 'expo'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { StatusBar } from 'expo-status-bar'
import Navigation from './src/navigation'

function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Navigation />
    </GestureHandlerRootView>
  )
}

registerRootComponent(App)
