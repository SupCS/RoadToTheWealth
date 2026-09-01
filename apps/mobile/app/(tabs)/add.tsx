import { Redirect } from 'expo-router';

// Normal tab presses are intercepted by the layout; the redirect also makes deep links safe.
export default function QuickAddPlaceholder() {
  return <Redirect href="/transaction/new" />;
}
