# Subscription Plan

The app is currently set up with a freemium flow:

- Free users can open recipes where `recipes.is_premium = false`.
- Premium recipes show a locked card and send users to login or the subscription screen.
- The app has a temporary "Preview unlock for testing" button so development can continue before payments are connected.

Before app store launch, replace the temporary preview button with RevenueCat:

1. Create the subscription product in Apple App Store Connect and Google Play Console.
2. Connect both store products to one RevenueCat entitlement, for example `premium`.
3. Install RevenueCat in the Expo app and check whether the signed-in user has the `premium` entitlement.
4. Store only app profile data in Supabase. Let RevenueCat be the source of truth for active subscription status.
5. Remove the temporary local preview toggle after real purchases and restore checks are working.
